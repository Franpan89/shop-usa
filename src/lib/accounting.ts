import 'server-only';
import type { InvoiceLineKind, InvoiceType, PaymentMethod } from '@prisma/client';
import { audit, nextNumber, type Db } from '@/lib/tenant';
import { fromCents, toCents } from '@/lib/domain/money';
import { invoiceStatusFor, planAllocations, runningBalances } from '@/lib/domain/ledger';
import { computeOrderStatus, INVOICE_TYPE, PAYMENT_METHOD_LABEL } from '@/lib/domain/flow';

/**
 * Libro de cuentas del cliente (Etapa 7).
 * Los pedidos y despachos generan CARGOS (facturas); los pagos pertenecen al CLIENTE y
 * se reparten solos entre sus cargos, empezando por el más antiguo.
 */

export interface InvoiceLineInput {
  kind: InvoiceLineKind;
  description: string;
  /** los descuentos van en negativo */
  amount: number;
}

export async function createInvoice(
  db: Db,
  input: {
    tenantId: string;
    clientId: string;
    type: InvoiceType;
    description?: string;
    lines: InvoiceLineInput[];
    orderId?: string;
    consolidationId?: string;
    issueDate?: Date;
  },
) {
  const number = await nextNumber(db, input.tenantId, 'invoice');
  const totalCents = input.lines.reduce((sum, l) => sum + toCents(l.amount), 0);
  return db.invoice.create({
    data: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      number,
      type: input.type,
      description: input.description,
      total: fromCents(totalCents),
      status: totalCents <= 0 ? 'PAID' : 'PENDING',
      issueDate: input.issueDate ?? new Date(),
      orderId: input.orderId,
      consolidationId: input.consolidationId,
      lines: {
        create: input.lines.map((l, i) => ({
          kind: l.kind,
          description: l.description,
          amount: fromCents(toCents(l.amount)),
          sortOrder: i,
        })),
      },
    },
  });
}

/**
 * Si una factura se reduce (editar un pedido, agregar un descuento) por debajo de lo ya
 * aplicado, se devuelve el exceso al saldo a favor del cliente quitando las aplicaciones más recientes.
 */
async function trimOverAllocations(db: Db, clientId: string) {
  const invoices = await db.invoice.findMany({
    where: { clientId, status: { not: 'CANCELLED' } },
    select: { id: true, total: true },
  });
  const sums = await db.paymentAllocation.groupBy({
    by: ['invoiceId'],
    where: { invoice: { clientId } },
    _sum: { amount: true },
  });
  const allocatedById = new Map(sums.map((s) => [s.invoiceId, toCents(s._sum.amount ?? 0)]));

  for (const inv of invoices) {
    let excess = (allocatedById.get(inv.id) ?? 0) - toCents(inv.total);
    if (excess <= 0) continue;
    const allocations = await db.paymentAllocation.findMany({
      where: { invoiceId: inv.id },
      orderBy: { createdAt: 'desc' },
    });
    for (const a of allocations) {
      if (excess <= 0) break;
      const cents = toCents(a.amount);
      if (cents <= excess) {
        await db.paymentAllocation.delete({ where: { id: a.id } });
        excess -= cents;
      } else {
        await db.paymentAllocation.update({ where: { id: a.id }, data: { amount: fromCents(cents - excess) } });
        excess = 0;
      }
    }
  }
}

/** Recalcula lo pagado de cada factura a partir de sus aplicaciones. */
async function recomputeInvoices(db: Db, clientId: string) {
  const invoices = await db.invoice.findMany({
    where: { clientId },
    select: { id: true, total: true, status: true, paidAmount: true, type: true, orderId: true },
  });
  const sums = await db.paymentAllocation.groupBy({
    by: ['invoiceId'],
    where: { invoice: { clientId } },
    _sum: { amount: true },
  });
  const paidById = new Map(sums.map((s) => [s.invoiceId, toCents(s._sum.amount ?? 0)]));

  for (const inv of invoices) {
    if (inv.status === 'CANCELLED') continue;
    const paid = paidById.get(inv.id) ?? 0;
    const status = invoiceStatusFor(toCents(inv.total), paid);
    if (status !== inv.status || Math.abs(fromCents(paid) - inv.paidAmount) > 0.001) {
      await db.invoice.update({ where: { id: inv.id }, data: { status, paidAmount: fromCents(paid) } });
    }
  }
}

/**
 * Aplica automáticamente el dinero disponible del cliente a sus cargos pendientes
 * (más antiguo primero; una factura destino indicada por el pago se cubre antes) y
 * dispara los efectos de que una factura quede pagada o deje de estarlo.
 */
export async function reconcileClient(db: Db, clientId: string) {
  const before = await db.invoice.findMany({
    where: { clientId, status: { not: 'CANCELLED' } },
    select: { id: true, status: true },
  });
  const wasPaid = new Map(before.map((i) => [i.id, i.status === 'PAID']));

  await trimOverAllocations(db, clientId);
  await recomputeInvoices(db, clientId);

  const invoices = await db.invoice.findMany({
    where: { clientId, status: { in: ['PENDING', 'PARTIAL'] } },
    orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    select: { id: true, total: true, paidAmount: true },
  });
  const payments = await db.payment.findMany({
    where: { clientId, status: 'APPROVED' },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, amount: true, targetInvoiceId: true, allocations: { select: { amount: true } } },
  });

  const plan = planAllocations(
    invoices.map((i) => ({ id: i.id, due: toCents(i.total) - toCents(i.paidAmount) })),
    payments.map((p) => ({
      id: p.id,
      available: toCents(p.amount) - p.allocations.reduce((s, a) => s + toCents(a.amount), 0),
      targetInvoiceId: p.targetInvoiceId,
    })),
  );

  if (plan.allocations.length > 0) {
    await db.paymentAllocation.createMany({
      data: plan.allocations.map((a) => ({
        paymentId: a.paymentId,
        invoiceId: a.invoiceId,
        amount: fromCents(a.amount),
      })),
    });
    await recomputeInvoices(db, clientId);
  }

  const after = await db.invoice.findMany({
    where: { clientId },
    select: { id: true, status: true, type: true, orderId: true },
  });
  for (const inv of after) {
    if (inv.status === 'CANCELLED') continue;
    const nowPaid = inv.status === 'PAID';
    if (wasPaid.get(inv.id) === nowPaid && wasPaid.has(inv.id)) continue;
    if (inv.orderId) {
      await refreshOrder(db, inv.orderId);
      if (nowPaid && (inv.type === 'PERSONAL_SHOPPER' || inv.type === 'CART')) {
        await maybeGenerateReferralBenefit(db, clientId, inv.id);
      }
    }
  }
}

/** Saldos del cliente: positivo = debe; los saldos a favor se reportan aparte. */
export async function getClientAccount(db: Db, clientId: string) {
  const [invoices, payments, allocations] = await Promise.all([
    db.invoice.findMany({ where: { clientId, status: { not: 'CANCELLED' } }, select: { total: true, paidAmount: true } }),
    db.payment.findMany({ where: { clientId, status: 'APPROVED' }, select: { amount: true } }),
    db.paymentAllocation.aggregate({ where: { payment: { clientId, status: 'APPROVED' } }, _sum: { amount: true } }),
  ]);
  const charged = invoices.reduce((s, i) => s + toCents(i.total), 0);
  const paid = payments.reduce((s, p) => s + toCents(p.amount), 0);
  const pending = invoices.reduce((s, i) => s + Math.max(0, toCents(i.total) - toCents(i.paidAmount)), 0);
  const credit = Math.max(0, paid - toCents(allocations._sum.amount ?? 0));
  return {
    charged: fromCents(charged),
    paid: fromCents(paid),
    pending: fromCents(pending),
    credit: fromCents(credit),
    /** neto: positivo debe, negativo a favor */
    net: fromCents(charged - paid),
  };
}

/** Saldos de varios clientes de una sola vez (listados). */
export async function getAccountsByClient(db: Db, clientIds?: string[]) {
  const where = clientIds ? { clientId: { in: clientIds } } : {};
  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({ where: { ...where, status: { not: 'CANCELLED' } }, select: { clientId: true, total: true, paidAmount: true } }),
    db.payment.findMany({ where: { ...where, status: 'APPROVED' }, select: { clientId: true, amount: true } }),
  ]);
  const map = new Map<string, { pending: number; credit: number; net: number }>();
  const add = (id: string) => {
    if (!map.has(id)) map.set(id, { pending: 0, credit: 0, net: 0 });
    return map.get(id)!;
  };
  for (const i of invoices) {
    const e = add(i.clientId);
    e.pending += Math.max(0, toCents(i.total) - toCents(i.paidAmount));
    e.net += toCents(i.total);
  }
  for (const p of payments) add(p.clientId).net -= toCents(p.amount);
  const out = new Map<string, { pending: number; credit: number; net: number }>();
  for (const [id, e] of map) {
    out.set(id, { pending: fromCents(e.pending), credit: fromCents(Math.max(0, -e.net)), net: fromCents(e.net) });
  }
  return out;
}

export interface StatementRow {
  key: string;
  date: Date;
  kind: 'INVOICE' | 'PAYMENT' | 'CREDIT';
  description: string;
  reference?: string;
  href?: string;
  statusLabel?: string;
  charge: number;
  credit: number;
  balance: number;
  /** filas informativas que no mueven el saldo (pagos por verificar, facturas anuladas) */
  informational?: boolean;
}

/** Historial cronológico: fecha, concepto, referencia, cargo, pago/crédito y saldo resultante (7.15). */
export async function getStatement(db: Db, clientId: string, opts: { staffLinks?: boolean } = {}) {
  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: { clientId },
      include: { order: { select: { id: true } } },
      orderBy: { issueDate: 'asc' },
    }),
    db.payment.findMany({ where: { clientId }, orderBy: { paidAt: 'asc' } }),
  ]);

  const invoiceStatus = { PENDING: 'Pendiente', PARTIAL: 'Parcial', PAID: 'Pagada', CANCELLED: 'Anulada' } as const;
  const paymentStatus = { APPROVED: 'Aprobado', PENDING_VERIFICATION: 'Por verificar', REJECTED: 'Rechazado', VOIDED: 'Anulado' } as const;

  const raw = [
    ...invoices.map((i) => ({
      key: `i-${i.id}`,
      date: i.issueDate,
      kind: 'INVOICE' as const,
      description: i.description ?? INVOICE_TYPE[i.type],
      reference: `FAC-${String(i.number).padStart(4, '0')}`,
      href: i.order ? (opts.staffLinks ? `/pedidos/${i.order.id}` : `/portal/pedidos/${i.order.id}`) : undefined,
      statusLabel: invoiceStatus[i.status],
      // lo que mueve el saldo
      charge: i.status === 'CANCELLED' ? 0 : toCents(i.total),
      credit: 0,
      // lo que se muestra en las columnas
      shownCharge: toCents(i.total),
      shownCredit: 0,
      informational: i.status === 'CANCELLED',
    })),
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      date: p.paidAt,
      kind: (p.kind === 'CREDIT_ADJUSTMENT' ? 'CREDIT' : 'PAYMENT') as 'PAYMENT' | 'CREDIT',
      description: p.kind === 'CREDIT_ADJUSTMENT' ? (p.note ?? 'Crédito a favor') : (p.note ?? PAYMENT_METHOD_LABEL[p.method] ?? 'Pago'),
      reference: p.reference ?? undefined,
      href: undefined as string | undefined,
      statusLabel: paymentStatus[p.status],
      charge: 0,
      credit: p.status === 'APPROVED' ? toCents(p.amount) : 0,
      shownCharge: 0,
      shownCredit: toCents(p.amount),
      informational: p.status !== 'APPROVED',
    })),
  ];

  return runningBalances(raw).map(
    (r): StatementRow => ({
      key: r.key,
      date: r.date,
      kind: r.kind,
      description: r.description,
      reference: r.reference,
      href: r.href,
      statusLabel: r.statusLabel,
      charge: fromCents(r.shownCharge),
      credit: fromCents(r.shownCredit),
      balance: fromCents(r.balance),
      informational: r.informational,
    }),
  );
}

// ── Pagos ───────────────────────────────────────────────────────────────────

export async function createPayment(
  db: Db,
  input: {
    tenantId: string;
    clientId: string;
    amount: number;
    method: PaymentMethod;
    source: 'CLIENT' | 'STAFF';
    paidAt?: Date;
    reference?: string;
    proofUrl?: string;
    note?: string;
    targetInvoiceId?: string | null;
    approved?: boolean;
    verifiedBy?: string;
    kind?: 'PAYMENT' | 'CREDIT_ADJUSTMENT';
  },
) {
  if (!(input.amount > 0)) throw new Error('El monto debe ser mayor a cero');
  const payment = await db.payment.create({
    data: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      amount: fromCents(toCents(input.amount)),
      method: input.method,
      source: input.source,
      kind: input.kind ?? 'PAYMENT',
      paidAt: input.paidAt ?? new Date(),
      reference: input.reference || null,
      proofUrl: input.proofUrl || null,
      note: input.note || null,
      targetInvoiceId: input.targetInvoiceId || null,
      status: input.approved ? 'APPROVED' : 'PENDING_VERIFICATION',
      verifiedBy: input.approved ? input.verifiedBy ?? null : null,
      verifiedAt: input.approved ? new Date() : null,
    },
  });
  await reconcileClient(db, input.clientId);
  return payment;
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

/**
 * Recalcula el estado del pedido a partir de la factura, los comprobantes y sus
 * productos, y sincroniza PENDIENTE DE PAGO ↔ LISTO PARA COMPRAR en los productos.
 */
export async function refreshOrder(db: Db, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { products: { select: { id: true, status: true } }, invoice: { select: { id: true, status: true } } },
  });
  if (!order) return;

  const invoicePaid = order.invoice?.status === 'PAID';
  const authorized = invoicePaid || order.courtesyAuthorized;

  if (authorized) {
    await db.product.updateMany({ where: { orderId, status: 'PENDING_PAYMENT' }, data: { status: 'READY_TO_BUY' } });
  } else if (!order.cancelledAt) {
    await db.product.updateMany({ where: { orderId, status: 'READY_TO_BUY' }, data: { status: 'PENDING_PAYMENT' } });
  }

  const products = await db.product.findMany({ where: { orderId }, select: { status: true } });
  const pendingProof = order.invoice
    ? await db.payment.count({
        where: {
          clientId: order.clientId,
          status: 'PENDING_VERIFICATION',
          OR: [{ targetInvoiceId: order.invoice.id }, { targetInvoiceId: null }],
        },
      })
    : 0;

  const status = computeOrderStatus({
    cancelled: !!order.cancelledAt,
    invoicePaid,
    courtesyAuthorized: order.courtesyAuthorized,
    hasPendingProof: pendingProof > 0,
    productStatuses: products.map((p) => p.status),
  });
  if (status !== order.status) await db.order.update({ where: { id: orderId }, data: { status } });
}

/** Refresca todos los pedidos con factura abierta de un cliente (comprobantes nuevos o rechazados). */
export async function refreshClientOrders(db: Db, clientId: string) {
  const orders = await db.order.findMany({
    where: { clientId, cancelledAt: null, status: { in: ['PENDING_PAYMENT', 'PAYMENT_REVIEW'] } },
    select: { id: true },
  });
  for (const o of orders) await refreshOrder(db, o.id);
}

// ── Referidos ───────────────────────────────────────────────────────────────

/**
 * El beneficio se genera solo cuando el referido completa su primera compra válida
 * (factura de Personal Shopper / Carrito pagada y aprobada). Un referido = un beneficio.
 */
async function maybeGenerateReferralBenefit(db: Db, clientId: string, invoiceId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true, referredById: true, referralBenefitGenerated: { select: { id: true } } },
  });
  if (!client?.referredById || client.referralBenefitGenerated) return;
  await db.referralBenefit.create({
    data: {
      tenantId: client.tenantId,
      referrerId: client.referredById,
      referredId: clientId,
      sourceInvoiceId: invoiceId,
    },
  });
}

export async function countAvailableBenefits(db: Db, clientId: string) {
  return db.referralBenefit.count({ where: { referrerId: clientId, status: 'AVAILABLE' } });
}

/** Toma el beneficio disponible más antiguo y lo asocia al pedido que lo utiliza. */
export async function consumeBenefit(db: Db, clientId: string, orderId: string) {
  const benefit = await db.referralBenefit.findFirst({
    where: { referrerId: clientId, status: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!benefit) return null;
  return db.referralBenefit.update({
    where: { id: benefit.id },
    data: { status: 'USED', usedOrderId: orderId, usedAt: new Date() },
  });
}

// ── Anulaciones ─────────────────────────────────────────────────────────────

/** Anula una factura: libera lo que se había aplicado y el dinero vuelve a quedar disponible. */
export async function cancelInvoice(db: Db, invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('Factura no encontrada');
  await db.paymentAllocation.deleteMany({ where: { invoiceId } });
  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: 'CANCELLED', paidAmount: 0, cancelledAt: new Date() },
  });
  await reconcileClient(db, invoice.clientId);
}

export async function voidPayment(db: Db, paymentId: string, userName: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('Pago no encontrado');
  await db.paymentAllocation.deleteMany({ where: { paymentId } });
  await db.payment.update({ where: { id: paymentId }, data: { status: 'VOIDED' } });
  await reconcileClient(db, payment.clientId);
  await audit(db, { userName, action: 'payment.void', entity: 'Payment', entityId: paymentId, data: { amount: payment.amount } });
}

