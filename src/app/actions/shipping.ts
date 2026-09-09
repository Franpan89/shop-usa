'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

async function getTenantId() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant no encontrado');
  return tenant.id;
}

function parseUnit(raw: FormDataEntryValue | null): 'HALF_LB' | 'LB' {
  return raw === 'LB' ? 'LB' : 'HALF_LB';
}

export async function createShippingCategory(formData: FormData) {
  const tenantId = await getTenantId();
  const name = (formData.get('name') as string)?.trim();
  const country = (formData.get('country') as string)?.trim();
  const rate = parseFloat(formData.get('rate') as string);
  const unit = parseUnit(formData.get('unit'));
  if (!name || !country || isNaN(rate) || rate <= 0) throw new Error('Datos inválidos');

  await prisma.shippingCategory.create({
    data: { tenantId, name, country, rate, unit },
  });

  revalidatePath('/configuraciones');
}

export async function updateShippingCategory(formData: FormData) {
  const id = formData.get('id') as string;
  const rate = parseFloat(formData.get('rate') as string);
  const unit = parseUnit(formData.get('unit'));
  if (!id || isNaN(rate) || rate <= 0) throw new Error('Datos inválidos');

  await prisma.shippingCategory.update({
    where: { id },
    data: { rate, unit },
  });

  revalidatePath('/configuraciones');
}

export async function deleteShippingCategory(id: string) {
  await prisma.shippingCategory.delete({ where: { id } });
  revalidatePath('/configuraciones');
}
