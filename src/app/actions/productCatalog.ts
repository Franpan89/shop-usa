'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';

export interface CatalogInput {
  name: string;
  defaultPurchaseValue?: number | null;
  notes?: string | null;
}

export const createCatalogEntry = safe(async function createCatalogEntry(input: CatalogInput) {
  await requireStaff();
  const name = input.name?.trim();
  if (!name) throw new Error('El nombre es requerido');
  const tenantId = await getTenantId();

  await prisma.productCatalog.create({
    data: { tenantId, name, defaultPurchaseValue: input.defaultPurchaseValue ?? null, notes: input.notes ?? null },
  });

  revalidatePath('/productos');
  return { success: true };
});

export const updateCatalogEntry = safe(async function updateCatalogEntry(id: string, input: CatalogInput) {
  await requireStaff();
  if (!id) throw new Error('Id required');
  const name = input.name?.trim();
  if (!name) throw new Error('El nombre es requerido');

  await prisma.productCatalog.update({
    where: { id },
    data: { name, defaultPurchaseValue: input.defaultPurchaseValue ?? null, notes: input.notes ?? null },
  });

  revalidatePath('/productos');
  return { success: true };
});

export const deleteCatalogEntry = safe(async function deleteCatalogEntry(id: string) {
  await requireStaff();
  if (!id) throw new Error('Id required');
  await prisma.productCatalog.delete({ where: { id } });
  revalidatePath('/productos');
  return { success: true };
});
