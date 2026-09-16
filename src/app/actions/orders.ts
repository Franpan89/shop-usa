'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ORDER_STATUSES, normalizeOrderStatus, type OrderStatus } from '@/lib/orderStatus';
import { recordCatalogUsage } from './productCatalog';
import { sendOrderShippedEmail } from '@/lib/email';

const TAX_RATE = 0.065; // 6.5% on SHOPUSA purchase values

export async function createOrder(
  clientId: string,
  shipment: { weight: number; shippingCost: number },
  products: any[],
) {
  if (!clientId || !products || products.length === 0) {
    throw new Error('Client and at least one product are required');
  }

  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  // Fetch client's service fee %
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { serviceFeePercent: true },
  });
  const feePercent = client?.serviceFeePercent ?? 20;

  // The order is weighed and shipped as one package — weight and shipping
  // cost are a single figure for the whole order, not per product.
  const weight = shipment.weight || 0;
  const shippingCost = shipment.shippingCost || 0;

  // Calculate totals
  let taxableAmount = 0;
  let totalPrepaid = 0;

  const productData = products.map((p: any) => {
    const purchaseValue = p.purchasedBy === 'SHOPUSA' ? (parseFloat(p.purchaseValue) || 0) : 0;
    const prepaid = parseFloat(p.prepaidAmount) || 0;

    if (p.purchasedBy === 'SHOPUSA') taxableAmount += purchaseValue;
    totalPrepaid += prepaid;

    return {
      name: p.name,
      purchasedBy: p.purchasedBy,
      purchaseValue: p.purchasedBy === 'SHOPUSA' ? parseFloat(p.purchaseValue) : null,
      prepaidAmount: prepaid,
    };
  });

  const baseAmount = shippingCost + taxableAmount;
  const taxAmount = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
  // Service fee is 20% (or the client's rate) of the SHOPUSA purchase value + its
  // tax only — shipping cost never attracts the fee, whether the item was
  // purchased by the client or by ShopUSA.
  const serviceFeeAmount = parseFloat(((taxableAmount + taxAmount) * feePercent / 100).toFixed(2));
  const totalAmount = parseFloat((baseAmount + taxAmount + serviceFeeAmount).toFixed(2));
  const balance = parseFloat((totalAmount - totalPrepaid).toFixed(2));

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId,
      weight,
      shippingCost,
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
      purchasedBy: p.purchasedBy as 'CLIENT' | 'SHOPUSA',
      purchaseValue: p.purchaseValue ?? null,
    });
  }

  revalidatePath('/pedidos');
  revalidatePath('/productos');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true, orderId: order.id };
}

export interface ProductFormInput {
  name: string;
  purchasedBy: 'CLIENT' | 'SHOPUSA';
  purchaseValue: number | null;
  prepaidAmount: number;
}

/**
 * Recomputes an order's tax/fee/total from its current products and its own
 * weight/shippingCost, then sets balance from the given "already paid"
 * figure — never re-derived from products' prepaidAmount, since
 * registerPayment() adjusts balance directly and isn't reflected back onto
 * any single product.
 */
async function recalcOrderTotals(orderId: string, paidSoFar: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { products: true },
  });
  if (!order) throw new Error('Order not found');

  const taxableAmount = order.products.reduce(
    (sum, p) => sum + (p.purchasedBy === 'SHOPUSA' ? p.purchaseValue ?? 0 : 0),
    0,
  );
  const baseAmount = order.shippingCost + taxableAmount;
  const taxAmount = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
  const serviceFeeAmount = parseFloat(((taxableAmount + taxAmount) * order.serviceFeePercent / 100).toFixed(2));
  const totalAmount = parseFloat((baseAmount + taxAmount + serviceFeeAmount).toFixed(2));
  const balance = parseFloat((totalAmount - paidSoFar).toFixed(2));

  await prisma.order.update({
    where: { id: orderId },
    data: { totalAmount, taxAmount, serviceFeeAmount, balance },
  });
}

export async function addProductToOrder(orderId: string, input: ProductFormInput) {
  if (!orderId) throw new Error('Order id required');
  if (!input.name?.trim()) throw new Error('El nombre es requerido');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalAmount: true, balance: true, clientId: true, tenantId: true },
  });
  if (!order) throw new Error('Order not found');

  const paidSoFar = order.totalAmount - order.balance;
  const purchaseValue = input.purchasedBy === 'SHOPUSA' ? input.purchaseValue ?? 0 : null;

  await prisma.product.create({
    data: {
      orderId,
      name: input.name.trim(),
      purchasedBy: input.purchasedBy,
      purchaseValue,
      prepaidAmount: input.prepaidAmount,
    },
  });

  await recalcOrderTotals(orderId, paidSoFar + input.prepaidAmount);
  await recordCatalogUsage(order.tenantId, {
    name: input.name.trim(),
    purchasedBy: input.purchasedBy,
    purchaseValue,
  });

  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/productos');
  revalidatePath('/cajas');
  revalidatePath(`/clientes/${order.clientId}`);
}

export async function updateProduct(productId: string, input: ProductFormInput) {
  if (!productId) throw new Error('Product id required');
  if (!input.name?.trim()) throw new Error('El nombre es requerido');

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    include: { order: { select: { id: true, totalAmount: true, balance: true, clientId: true } } },
  });
  if (!existing) throw new Error('Product not found');

  const orderId = existing.orderId;
  const paidSoFar = existing.order.totalAmount - existing.order.balance;
  const purchaseValue = input.purchasedBy === 'SHOPUSA' ? input.purchaseValue ?? 0 : null;

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: input.name.trim(),
      purchasedBy: input.purchasedBy,
      purchaseValue,
      prepaidAmount: input.prepaidAmount,
    },
  });

  await recalcOrderTotals(orderId, paidSoFar - existing.prepaidAmount + input.prepaidAmount);

  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/cajas');
  revalidatePath(`/clientes/${existing.order.clientId}`);
}

export async function updateOrderShipment(orderId: string, weight: number, shippingCost: number) {
  if (!orderId) throw new Error('Order id required');
  if (!Number.isFinite(weight) || weight < 0) throw new Error('Peso inválido');
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw new Error('Costo de envío inválido');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalAmount: true, balance: true, clientId: true, boxId: true },
  });
  if (!order) throw new Error('Order not found');

  const paidSoFar = order.totalAmount - order.balance;

  await prisma.order.update({
    where: { id: orderId },
    data: { weight, shippingCost },
  });

  await recalcOrderTotals(orderId, paidSoFar);
  if (order.boxId) await recomputeBoxWeight(order.boxId);

  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/cajas');
  revalidatePath(`/clientes/${order.clientId}`);
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

  if (nextStatus === 'SHIPPED') await notifyOrderShipped(orderId);

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

  if (status === 'SHIPPED') await notifyOrderShipped(orderId);

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

export async function confirmOrderReceived(orderId: string) {
  if (!orderId) throw new Error('Order id required');

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { receivedStatus: 'OK', receivedNote: null, receivedAt: new Date() },
    select: { clientId: true, boxId: true },
  });

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

export async function reportOrderIssue(orderId: string, note: string) {
  if (!orderId) throw new Error('Order id required');
  const trimmed = note?.trim();
  if (!trimmed) throw new Error('Describe la novedad');

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { receivedStatus: 'NOVEDAD', receivedNote: trimmed, receivedAt: new Date() },
    select: { clientId: true, boxId: true },
  });

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

export async function undoOrderReceipt(orderId: string) {
  if (!orderId) throw new Error('Order id required');

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { receivedStatus: null, receivedNote: null, receivedAt: null },
    select: { clientId: true, boxId: true },
  });

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath(`/clientes/${order.clientId}`);
  return { success: true };
}

async function notifyOrderShipped(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: true, products: true, box: true },
  });
  if (!order?.client.email) return;

  await sendOrderShippedEmail({
    to: order.client.email,
    clientName: order.client.name,
    orderRef: `#${order.id.slice(-6).toUpperCase()}`,
    products: order.products.map((p) => ({ name: p.name })),
    weight: order.weight,
    boxLabel: order.box?.internalId,
  });
}

async function recomputeBoxWeight(boxId: string) {
  const result = await prisma.order.aggregate({
    where: { boxId },
    _sum: { weight: true },
  });
  await prisma.box.update({
    where: { id: boxId },
    data: { totalWeight: parseFloat((result._sum.weight ?? 0).toFixed(2)) },
  });
}
