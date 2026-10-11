'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';

function parseUnit(raw: FormDataEntryValue | null): 'HALF_LB' | 'LB' {
  return raw === 'LB' ? 'LB' : 'HALF_LB';
}

export const createShippingCategory = safe(async function createShippingCategory(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  const name = (formData.get('name') as string)?.trim();
  const country = (formData.get('country') as string)?.trim();
  const pricePerLb = parseFloat(formData.get('pricePerLb') as string);
  const unit = parseUnit(formData.get('unit'));
  if (!name || !country || Number.isNaN(pricePerLb) || pricePerLb <= 0) throw new Error('Datos inválidos');

  await prisma.shippingCategory.create({ data: { tenantId, name, country, pricePerLb, unit } });
  revalidatePath('/configuraciones');
});

export const updateShippingCategory = safe(async function updateShippingCategory(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();
  const country = (formData.get('country') as string)?.trim();
  const pricePerLb = parseFloat(formData.get('pricePerLb') as string);
  const unit = parseUnit(formData.get('unit'));
  if (!id || !name || !country || Number.isNaN(pricePerLb) || pricePerLb <= 0) throw new Error('Datos inválidos');

  // Cambiar el país de una tarifa con clientes asignados dejaría clientes con una tarifa de otro país.
  const current = await prisma.shippingCategory.findUnique({ where: { id }, include: { _count: { select: { clients: true } } } });
  if (!current) throw new Error('Tarifa no encontrada');
  if (current.country !== country && current._count.clients > 0) {
    throw new Error('No puedes cambiar el país de una tarifa que ya tiene clientes asignados');
  }

  await prisma.shippingCategory.update({ where: { id }, data: { name, country, pricePerLb, unit } });
  revalidatePath('/configuraciones');
});

export const setShippingCategoryActive = safe(async function setShippingCategoryActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.shippingCategory.update({ where: { id }, data: { active } });
  revalidatePath('/configuraciones');
});

export const deleteShippingCategory = safe(async function deleteShippingCategory(id: string) {
  await requireAdmin();
  const clients = await prisma.client.count({ where: { shippingCategoryId: id } });
  if (clients > 0) throw new Error(`Tiene ${clients} cliente(s) asignado(s); desactívala en lugar de eliminarla.`);
  await prisma.shippingCategory.delete({ where: { id } });
  revalidatePath('/configuraciones');
});
