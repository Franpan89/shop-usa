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

  // Calculate totals
  let totalAmount = 0;
  let totalPrepaid = 0;

  const productData = products.map((p: any) => {
    const shippingCost = p.shippingCost || 0;
    const purchaseValue = p.purchasedBy === 'SHOPUSA' ? (p.purchaseValue || 0) : 0;
    const prepaid = p.prepaidAmount || 0;

    const itemTotal = shippingCost + purchaseValue;
    totalAmount += itemTotal;
    totalPrepaid += prepaid;

    return {
      name: p.name,
      weight: parseFloat(p.weight) || 0,
      purchasedBy: p.purchasedBy,
      purchaseValue: p.purchasedBy === 'SHOPUSA' ? parseFloat(p.purchaseValue) : null,
      prepaidAmount: parseFloat(p.prepaidAmount) || 0,
      shippingCost: parseFloat(p.shippingCost) || 0,
    };
  });

  const balance = totalAmount - totalPrepaid;

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId,
      totalAmount,
      balance,
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
