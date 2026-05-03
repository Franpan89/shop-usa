'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

async function getTenantId() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant no encontrado');
  return tenant.id;
}

export async function upsertCountryRate(formData: FormData) {
  const tenantId = await getTenantId();
  const country = (formData.get('country') as string).trim();
  const ratePerHalfLb = parseFloat(formData.get('ratePerHalfLb') as string);
  if (!country || isNaN(ratePerHalfLb) || ratePerHalfLb <= 0) throw new Error('Datos inválidos');

  await prisma.shippingCountryRate.upsert({
    where: { tenantId_country: { tenantId, country } },
    create: { tenantId, country, ratePerHalfLb },
    update: { ratePerHalfLb },
  });

  revalidatePath('/configuraciones');
}

export async function deleteCountryRate(id: string) {
  await prisma.shippingCountryRate.delete({ where: { id } });
  revalidatePath('/configuraciones');
}
