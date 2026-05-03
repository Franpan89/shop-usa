'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createAdjustment(clientId: string, formData: FormData) {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant no encontrado');

  await prisma.clientAdjustment.create({
    data: {
      tenantId: tenant.id,
      clientId,
      date: new Date(formData.get('date') as string),
      type: formData.get('type') as 'CARGO' | 'CREDITO',
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
    },
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/clientes/${clientId}/estado-de-cuenta`);
}

export async function deleteAdjustment(id: string, clientId: string) {
  await prisma.clientAdjustment.delete({ where: { id } });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/clientes/${clientId}/estado-de-cuenta`);
}
