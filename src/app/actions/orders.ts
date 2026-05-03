'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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
      status: 'PENDING',
      products: {
        create: productData,
      },
    },
  });

  revalidatePath('/pedidos');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true, orderId: order.id };
}
