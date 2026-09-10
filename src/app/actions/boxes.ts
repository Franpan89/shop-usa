'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { sendBoxArrivedEmail } from '@/lib/email';

export async function createBox(input: {
  internalId: string;
  size: string;
  country: string;
}) {
  const internalId = input.internalId?.trim();
  const size = input.size?.trim();
  const country = input.country?.trim();
  if (!internalId || !size || !country) {
    throw new Error('ID interno, tamaño y país son requeridos');
  }

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  const box = await prisma.box.create({
    data: {
      tenantId: tenant.id,
      internalId,
      size,
      country,
      status: 'IN_TRANSIT',
      totalWeight: 0,
    },
  });

  revalidatePath('/cajas');
  revalidatePath('/pedidos');
  return { success: true, boxId: box.id };
}

export async function deleteBox(boxId: string) {
  if (!boxId) throw new Error('Box id required');

  const orderCount = await prisma.order.count({ where: { boxId } });
  if (orderCount > 0) {
    throw new Error(`No se puede eliminar: la caja tiene ${orderCount} pedido(s) asignado(s).`);
  }

  await prisma.box.delete({ where: { id: boxId } });

  revalidatePath('/cajas');
  return { success: true };
}

export async function markBoxArrived(boxId: string) {
  if (!boxId) throw new Error('Box id required');

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: { id: true, orders: { select: { id: true, clientId: true } } },
  });
  if (!box) throw new Error('Box not found');

  await prisma.order.updateMany({
    where: { boxId },
    data: { status: 'ARRIVED' },
  });

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  for (const o of box.orders) revalidatePath(`/clientes/${o.clientId}`);
  return { success: true, count: box.orders.length };
}

export async function notifyBoxArrival(boxId: string) {
  await requireStaff(); // Admin or Sub-admin — both allowed

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    include: { orders: { include: { client: true, products: true } } },
  });
  if (!box) throw new Error('Caja no encontrada');

  const ordersByClient = new Map<string, { client: typeof box.orders[number]['client']; products: { name: string; weight: number }[] }>();
  for (const order of box.orders) {
    if (!ordersByClient.has(order.clientId)) {
      ordersByClient.set(order.clientId, { client: order.client, products: [] });
    }
    ordersByClient.get(order.clientId)!.products.push(...order.products.map((p) => ({ name: p.name, weight: p.weight })));
  }

  let sent = 0;
  for (const { client, products } of ordersByClient.values()) {
    if (!client.email || products.length === 0) continue;
    await sendBoxArrivedEmail({ to: client.email, clientName: client.name, products });
    sent++;
  }

  return { success: true, sent, totalClients: ordersByClient.size };
}

export async function markBoxDelivered(boxId: string) {
  if (!boxId) throw new Error('Box id required');

  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: { id: true, orders: { select: { id: true, clientId: true } } },
  });
  if (!box) throw new Error('Box not found');

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { boxId },
      data: { status: 'DELIVERED' },
    }),
    prisma.box.update({
      where: { id: boxId },
      data: { status: 'DELIVERED' },
    }),
  ]);

  revalidatePath('/pedidos');
  revalidatePath('/cajas');
  revalidatePath('/');
  for (const o of box.orders) revalidatePath(`/clientes/${o.clientId}`);
  return { success: true, count: box.orders.length };
}
