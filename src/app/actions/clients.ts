'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createClient(formData: FormData) {
  const name = formData.get('name') as string;
  const idNumber = formData.get('idNumber') as string;
  const code = formData.get('code') as string;
  const country = formData.get('country') as string;
  const city = formData.get('city') as string;
  const phone = formData.get('phone') as string;
  const birthdayStr = formData.get('birthday') as string;
  const notes = formData.get('notes') as string;
  const deliveryMethod = formData.get('deliveryMethod') as any;
  const deliveryAddress = formData.get('deliveryAddress') as string;

  const birthday = birthdayStr ? new Date(birthdayStr) : null;

  if (!name || !code || !country) {
    throw new Error('Name, Code, and Country are required');
  }

  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  await prisma.client.create({
    data: {
      tenantId: tenant.id,
      name,
      idNumber,
      code,
      country,
      city,
      phone,
      birthday,
      notes,
      deliveryMethod,
      deliveryAddress,
    },
  });

  revalidatePath('/clientes');
  return { success: true };
}

export async function updateClient(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const idNumber = formData.get('idNumber') as string;
  const code = formData.get('code') as string;
  const country = formData.get('country') as string;
  const city = formData.get('city') as string;
  const phone = formData.get('phone') as string;
  const birthdayStr = formData.get('birthday') as string;
  const notes = formData.get('notes') as string;
  const deliveryMethod = formData.get('deliveryMethod') as any;
  const deliveryAddress = formData.get('deliveryAddress') as string;

  const birthday = birthdayStr ? new Date(birthdayStr) : null;

  await prisma.client.update({
    where: { id },
    data: {
      name,
      idNumber,
      code,
      country,
      city,
      phone,
      birthday,
      notes,
      deliveryMethod,
      deliveryAddress,
    },
  });

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  return { success: true };
}

