'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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
