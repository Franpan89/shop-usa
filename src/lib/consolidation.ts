import 'server-only';
import prisma from '@/lib/prisma';
import { audit, type Db } from '@/lib/tenant';
import { createInvoice, reconcileClient } from '@/lib/accounting';
import { billableWeight, shippingCost } from '@/lib/domain/pricing';

/** Cada cliente tiene como máximo un consolidado abierto; se crea al recibir su primer producto. */
export async function ensureOpenConsolidation(db: Db, tenantId: string, clientId: string) {
  const open = await db.consolidation.findFirst({ where: { clientId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
  if (open) return open;
  return db.consolidation.create({ data: { tenantId, clientId } });
}

/**
 * Marca productos como RECIBIDOS e incorpora cada uno al consolidado abierto de su cliente.
 * Los productos nuevos NO reinician la fecha de inicio de la retención.
 */
export async function receiveIntoConsolidation(db: Db, tenantId: string, productIds: string[]) {
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, clientId: true } });
  const byClient = new Map<string, string[]>();
  for (const p of products) {
    if (!byClient.has(p.clientId)) byClient.set(p.clientId, []);
    byClient.get(p.clientId)!.push(p.id);
  }
  const now = new Date();
  for (const [clientId, ids] of byClient) {
    const consolidation = await ensureOpenConsolidation(db, tenantId, clientId);
    await db.product.updateMany({
      where: { id: { in: ids } },
      data: { status: 'RECEIVED', receivedAt: now, consolidationId: consolidation.id },
    });
  }
}

export interface ConsolidationEstimate {
  billableWeight: number;
  pricePerLb: number | null;
  billingUnit: 'HALF_LB' | 'LB' | null;
  categoryName: string | null;
  cost: number | null;
}

/** Peso facturable y valor estimado del envío con la tarifa vigente del cliente. */
export function estimateShipping(
  realWeight: number,
  category: { name: string; pricePerLb: number; unit: 'HALF_LB' | 'LB' } | null | undefined,
): ConsolidationEstimate {
  if (!category) return { billableWeight: 0, pricePerLb: null, billingUnit: null, categoryName: null, cost: null };
  return {
    billableWeight: billableWeight(realWeight, category.unit),
    pricePerLb: category.pricePerLb,
    billingUnit: category.unit,
    categoryName: category.name,
    cost: shippingCost(realWeight, category.pricePerLb, category.unit),
  };
}

/**
 * Cierra el consolidado para despacho (3.19 / 7.2): congela peso real, peso facturable,
 * tarifa y valor del envío, y genera la factura de despacho en la cuenta del cliente.
 * Los productos que lleguen después pertenecerán a un consolidado nuevo.
 */
export async function closeConsolidationTx(db: Db, consolidationId: string, userName: string) {
  const consolidation = await db.consolidation.findUnique({
    where: { id: consolidationId },
    include: {
      client: { include: { shippingCategory: true } },
      products: { where: { status: { not: 'CANCELLED' } }, select: { id: true } },
    },
  });
  if (!consolidation) throw new Error('Consolidado no encontrado');
  if (consolidation.status === 'CLOSED') throw new Error('El consolidado ya está cerrado');
  if (consolidation.products.length === 0) throw new Error('El consolidado no tiene productos');
  if (!(consolidation.realWeight > 0)) throw new Error('Registra el peso del consolidado antes de cerrarlo');
  const category = consolidation.client.shippingCategory;
  if (!category) throw new Error(`${consolidation.client.name} no tiene una tarifa de envío asignada`);

  const estimate = estimateShipping(consolidation.realWeight, category);
  const cost = estimate.cost ?? 0;

  const updated = await db.consolidation.update({
    where: { id: consolidationId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      billableWeight: estimate.billableWeight,
      pricePerLb: category.pricePerLb,
      billingUnit: category.unit,
      shippingCategoryName: category.name,
      shippingCost: cost,
    },
  });

  await createInvoice(db, {
    tenantId: consolidation.tenantId,
    clientId: consolidation.clientId,
    type: 'SHIPPING',
    description: `Envío internacional — ${consolidation.realWeight.toFixed(2)} lb`,
    consolidationId,
    lines: [
      {
        kind: 'SHIPPING',
        description: `Envío ${category.name}: ${estimate.billableWeight} lb facturables × $${category.pricePerLb.toFixed(2)}/lb (peso real ${consolidation.realWeight.toFixed(2)} lb)`,
        amount: cost,
      },
    ],
  });
  await reconcileClient(db, consolidation.clientId);
  await audit(db, {
    userName,
    action: 'consolidation.close',
    entity: 'Consolidation',
    entityId: consolidationId,
    data: { realWeight: consolidation.realWeight, billable: estimate.billableWeight, cost },
  });
  return updated;
}

/**
 * Despachar / retener. Por defecto se despacha; al retener se registra la fecha de inicio,
 * que NO se reinicia cuando llegan productos nuevos (3.16).
 */
export async function applyDispatchDecision(consolidationId: string, decision: 'DISPATCH' | 'HOLD', actor: string) {
  const c = await prisma.consolidation.findUnique({ where: { id: consolidationId } });
  if (!c) throw new Error('Consolidado no encontrado');
  if (c.status === 'CLOSED') throw new Error('El consolidado ya fue cerrado para despacho');

  await prisma.consolidation.update({
    where: { id: consolidationId },
    data: {
      decision,
      decidedAt: new Date(),
      retentionStartedAt: decision === 'HOLD' ? (c.retentionStartedAt ?? new Date()) : c.retentionStartedAt,
    },
  });
  await audit(prisma, { userName: actor, action: `consolidation.${decision.toLowerCase()}`, entity: 'Consolidation', entityId: consolidationId });
}

