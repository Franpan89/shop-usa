'use server';

import { safe } from '@/lib/action';
import type { DispatchDecision } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdmin, requireStaff } from '@/lib/auth';
import { audit, inTransaction } from '@/lib/tenant';
import { cancelInvoice } from '@/lib/accounting';
import { applyDispatchDecision, closeConsolidationTx } from '@/lib/consolidation';
import { toCents, fromCents } from '@/lib/domain/money';

function revalidateConsolidation(clientId?: string) {
  revalidatePath('/consolidados');
  revalidatePath('/cajas');
  revalidatePath('/pagos');
  revalidatePath('/dashboard');
  revalidatePath('/portal', 'layout');
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

/**
 * Registra el peso consolidado del cliente. Es editable mientras el consolidado siga abierto:
 * cada vez que llegan productos nuevos se vuelve a pesar todo junto y se reemplaza el valor.
 */
export const setConsolidationWeight = safe(async function setConsolidationWeight(consolidationId: string, weight: number) {
  const user = await requireStaff();
  if (!Number.isFinite(weight) || weight < 0) throw new Error('Peso inválido');
  const c = await prisma.consolidation.findUnique({ where: { id: consolidationId } });
  if (!c) throw new Error('Consolidado no encontrado');
  if (c.status === 'CLOSED') throw new Error('El consolidado ya está cerrado; ábrelo de nuevo para corregir el peso');

  const next = fromCents(toCents(weight));
  await prisma.consolidation.update({ where: { id: consolidationId }, data: { realWeight: next, weightUpdatedAt: new Date() } });
  await audit(prisma, { userName: user.name, action: 'consolidation.weight', entity: 'Consolidation', entityId: consolidationId, data: { from: c.realWeight, to: next } });
  revalidateConsolidation(c.clientId);
  return { success: true };
});

export const setConsolidationDecision = safe(async function setConsolidationDecision(consolidationId: string, decision: DispatchDecision) {
  const user = await requireStaff();
  await applyDispatchDecision(consolidationId, decision, user.name);
  revalidateConsolidation();
  return { success: true };
});

/** Cierra el consolidado: congela peso/tarifa y genera la factura de despacho. */
export const closeConsolidation = safe(async function closeConsolidation(consolidationId: string) {
  const user = await requireStaff();
  const c = await prisma.consolidation.findUnique({ where: { id: consolidationId }, select: { clientId: true } });
  if (!c) throw new Error('Consolidado no encontrado');
  await inTransaction((tx) => closeConsolidationTx(tx, consolidationId, user.name));
  revalidateConsolidation(c.clientId);
  return { success: true };
});

/**
 * Cierre semanal: cierra y factura todos los consolidados abiertos que NO fueron retenidos
 * (sin respuesta = se despacha). Los que no tengan peso o tarifa se reportan para corregirlos.
 */
export const closeWeeklyBatch = safe(async function closeWeeklyBatch() {
  const user = await requireStaff();
  const candidates = await prisma.consolidation.findMany({
    where: { status: 'OPEN', decision: 'DISPATCH', products: { some: { status: 'RECEIVED' } } },
    include: { client: { select: { name: true } } },
  });

  const closed: string[] = [];
  const skipped: { client: string; reason: string }[] = [];
  for (const c of candidates) {
    try {
      await inTransaction((tx) => closeConsolidationTx(tx, c.id, user.name));
      closed.push(c.client.name);
    } catch (err) {
      skipped.push({ client: c.client.name, reason: err instanceof Error ? err.message : 'Error' });
    }
  }
  revalidateConsolidation();
  return { success: true, closed: closed.length, skipped };
});

/** Reabre un consolidado cerrado por error (solo si ningún producto está en un PKG). */
export const reopenConsolidation = safe(async function reopenConsolidation(consolidationId: string) {
  const user = await requireAdmin();
  const c = await prisma.consolidation.findUnique({
    where: { id: consolidationId },
    include: { invoice: { select: { id: true } }, products: { select: { pkgId: true } } },
  });
  if (!c) throw new Error('Consolidado no encontrado');
  if (c.status !== 'CLOSED') throw new Error('El consolidado no está cerrado');
  if (c.products.some((p) => p.pkgId)) throw new Error('Hay productos asignados a un PKG; retíralos primero');

  const open = await prisma.consolidation.findFirst({ where: { clientId: c.clientId, status: 'OPEN' } });
  if (open) throw new Error('El cliente ya tiene otro consolidado abierto');

  await inTransaction(async (tx) => {
    if (c.invoice) {
      await tx.consolidation.update({ where: { id: consolidationId }, data: { status: 'OPEN' } });
      await tx.invoice.update({ where: { id: c.invoice.id }, data: { consolidationId: null } });
      await cancelInvoice(tx, c.invoice.id);
    }
    await tx.consolidation.update({
      where: { id: consolidationId },
      data: { status: 'OPEN', closedAt: null, billableWeight: null, pricePerLb: null, billingUnit: null, shippingCategoryName: null, shippingCost: null },
    });
    await audit(tx, { userName: user.name, action: 'consolidation.reopen', entity: 'Consolidation', entityId: consolidationId });
  });
  revalidateConsolidation(c.clientId);
  return { success: true };
});
