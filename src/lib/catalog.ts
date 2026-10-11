import 'server-only';
import prisma from '@/lib/prisma';

/**
 * Se llama al crear pedidos por cada producto. Idempotente: upsert por (tenantId, name).
 * En entradas existentes solo se actualiza el uso; no se pisan los valores editados a mano.
 */
export async function recordCatalogUsage(tenantId: string, product: { name: string; unitPrice?: number | null }) {
  const name = product.name?.trim();
  if (!name) return;

  const now = new Date();
  await prisma.productCatalog.upsert({
    where: { tenantId_name: { tenantId, name } },
    create: { tenantId, name, defaultPurchaseValue: product.unitPrice ?? null, timesShipped: 1, lastUsedAt: now },
    update: { timesShipped: { increment: 1 }, lastUsedAt: now },
  });
}
