'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ORDER_STATUSES, normalizeOrderStatus, type OrderStatus } from '@/lib/orderStatus';
import { recordCatalogUsage } from './productCatalog';

export async function createOrder(clientId: string, products: any[]) {
  if (!clientId || !products || products.length === 0) {
    throw new Error('Client and at least one product are required');
  }

  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  const TAX_RATE = 0.065; // 6.5% on SHOPUSA purchase values

  // Fetch client's service fee %
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { serviceFeePercent: true },
  });
  const feePercent = client?.serviceFeePercent ?? 20;

  // Calculate totals
  let baseAmount = 0;
  let taxableAmount = 0;
  let totalPrepaid = 0;

  const productData = products.map((p: any) => {
    const shippingCost = parseFloat(p.shippingCost) || 0;
    const purchaseValue = p.purchasedBy === 'SHOPUSA' ? (parseFloat(p.purchaseValue) || 0) : 0;
    const prepaid = parseFloat(p.prepaidAmount) || 0;

    baseAmount += shippingCost + purchaseValue;
    if (p.purchasedBy === 'SHOPUSA') taxableAmount += purchaseValue;
    totalPrepaid += prepaid;

    return {
      name: p.name,
      weight: parseFloat(p.weight) || 0,
      purchasedBy: p.purchasedBy,
      purchaseValue: p.purchasedBy === 'SHOPUSA' ? parseFloat(p.purchaseValue) : null,
      prepaidAmount: prepaid,
      shippingCost,
    };
  });

  const taxAmount = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
  const baseWithTax = baseAmount + taxAmount;
  const serviceFeeAmount = parseFloat((baseWithTax * feePercent / 100).toFixed(2));
  const totalAmount = parseFloat((baseWithTax + serviceFeeAmount).toFixed(2));
  const balance = parseFloat((totalAmount - totalPrepaid).toFixed(2));

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId,
      totalAmount,
      balance,
      taxAmount,
      serviceFeePercent: feePercent,
      serviceFeeAmount,
      status: 'READY_TO_SHIP',
      products: {
        create: productData,
      },
    },
  });

  // Track usage in product catalog (idempotent upsert per product name)
  for (const p of productData) {
    await recordCatalogUsage(tenant.id, {
      name: p.name,
      weight: p.weight,
      purchasedBy: p.purchasedBy as 'CLIENT' | 'SHOPUSA',
      purchaseValue: p.purchaseValue ?? null,
    });
  }

  revalidatePath('/pedidos');
  revalidatePath('/productos');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true, orderId: order.id };
}

export async function deleteOrder(orderId: string) {
  if (!orderId) throw new Error('Order id required');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, boxId: true },
  });
  if (!order) throw new Error('Order not found');

  await prisma.$transaction([
    prisma.product.deleteMany({ where: { orderId } }),
    prisma.order.delete({ where: { id: orderId } }),
  ]);

  if (order.boxId) await recomputeBoxWeight(order.boxId);

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

export async function assignOrderToBox(orderId: string, boxId: string | null) {
  if (!orderId) throw new Error('Order id required');

  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: { boxId: true, clientId: true, status: true },
  });
  if (!current) throw new Error('Order not found');

  // Only nudge status when it makes sense — don't clobber loose-ship workflows.
  // Assigning a box to a READY_TO_SHIP order implies it's being shipped now.
  // Removing a box from a SHIPPED order reverts to READY_TO_SHIP.
  // All other cases (DELIVERED, ARRIVED, loose SHIPPED) leave status alone.
  const normalized = normalizeOrderStatus(current.status);
  let nextStatus: OrderStatus | undefined;
  if (boxId && normalized === 'READY_TO_SHIP') nextStatus = 'SHIPPED';
  else if (!boxId && normalized === 'SHIPPED' && current.boxId) nextStatus = 'READY_TO_SHIP';

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { boxId, ...(nextStatus ? { status: nextStatus } : {}) },
  });

  const boxesToRecompute = new Set<string>();
  if (current.boxId) boxesToRecompute.add(current.boxId);
  if (boxId) boxesToRecompute.add(boxId);
  for (const id of boxesToRecompute) await recomputeBoxWeight(id);

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath(`/clientes/${updated.clientId}`);
  return { success: true };
}

export async function registerPayment(orderId: string, amount: number) {
  if (!orderId) throw new Error('Order id required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto inválido');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { balance: true, clientId: true },
  });
  if (!order) throw new Error('Order not found');

  const newBalance = parseFloat((order.balance - amount).toFixed(2));

  await prisma.order.update({
    where: { id: orderId },
    data: { balance: newBalance },
  });

  revalidatePath('/pedidos');
  revalidatePath('/');
  revalidatePath(`/clientes/${order.clientId}`);
  revalidatePath(`/pedidos/${orderId}`);
  return { success: true, newBalance };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (!orderId) throw new Error('Order id required');
  if (!ORDER_STATUSES.includes(status)) throw new Error('Estado inválido');

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    select: { clientId: true, boxId: true },
  });

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

async function recomputeBoxWeight(boxId: string) {
  const orders = await prisma.order.findMany({
    where: { boxId },
    include: { products: true },
  });
  const totalWeight = orders.reduce(
    (sum, o) => sum + o.products.reduce((s, p) => s + (p.weight ?? 0), 0),
    0,
  );
  await prisma.box.update({
    where: { id: boxId },
    data: { totalWeight: parseFloat(totalWeight.toFixed(2)) },
  });
}
