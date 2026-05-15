'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type PurchasedByValue = 'CLIENT' | 'SHOPUSA';

export interface CatalogInput {
  name: string;
  defaultWeight?: number | null;
  defaultPurchaseValue?: number | null;
  defaultPurchasedBy?: PurchasedByValue;
  notes?: string | null;
}

export async function createCatalogEntry(input: CatalogInput) {
  const name = input.name?.trim();
  if (!name) throw new Error('El nombre es requerido');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  await prisma.productCatalog.create({
    data: {
      tenantId: tenant.id,
      name,
      defaultWeight: input.defaultWeight ?? null,
      defaultPurchaseValue: input.defaultPurchaseValue ?? null,
      defaultPurchasedBy: input.defaultPurchasedBy ?? 'CLIENT',
      notes: input.notes ?? null,
    },
  });

  revalidatePath('/productos');
  revalidatePath('/pedidos');
  return { success: true };
}

export async function updateCatalogEntry(id: string, input: CatalogInput) {
  if (!id) throw new Error('Id required');
  const name = input.name?.trim();
  if (!name) throw new Error('El nombre es requerido');

  await prisma.productCatalog.update({
    where: { id },
    data: {
      name,
      defaultWeight: input.defaultWeight ?? null,
      defaultPurchaseValue: input.defaultPurchaseValue ?? null,
      defaultPurchasedBy: input.defaultPurchasedBy ?? 'CLIENT',
      notes: input.notes ?? null,
    },
  });

  revalidatePath('/productos');
  revalidatePath('/pedidos');
  return { success: true };
}

export async function deleteCatalogEntry(id: string) {
  if (!id) throw new Error('Id required');
  await prisma.productCatalog.delete({ where: { id } });
  revalidatePath('/productos');
  return { success: true };
}

/**
 * Called from createOrder for each product. Idempotent — upserts by (tenantId, name).
 * On existing entries we only bump usage stats; we don't overwrite manual edits to defaults.
 */
export async function recordCatalogUsage(
  tenantId: string,
  product: {
    name: string;
    weight: number;
    purchasedBy: PurchasedByValue;
    purchaseValue?: number | null;
  },
) {
  const name = product.name?.trim();
  if (!name) return;

  const now = new Date();
  await prisma.productCatalog.upsert({
    where: { tenantId_name: { tenantId, name } },
    create: {
      tenantId,
      name,
      defaultWeight: product.weight || null,
      defaultPurchaseValue: product.purchaseValue ?? null,
      defaultPurchasedBy: product.purchasedBy,
      timesShipped: 1,
      lastUsedAt: now,
    },
    update: {
      timesShipped: { increment: 1 },
      lastUsedAt: now,
    },
  });
}
