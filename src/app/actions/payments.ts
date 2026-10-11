'use server';

import { safe } from '@/lib/action';
import type { InvoiceLineKind, PaymentMethod } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdmin, requireStaff } from '@/lib/auth';
import { audit, getSettings, getTenantId, inTransaction } from '@/lib/tenant';
import {
  cancelInvoice,
  createInvoice,
  createPayment,
  getClientAccount,
  reconcileClient,
  refreshClientOrders,
  voidPayment,
} from '@/lib/accounting';
import { fromCents, pctOfCents, toCents } from '@/lib/domain/money';
import { sendPaymentApprovedEmail, sendPaymentRejectedEmail } from '@/lib/email';

function revalidateFinance(clientId: string) {
  revalidatePath('/pagos');
  revalidatePath('/pedidos');
  revalidatePath('/compras');
  revalidatePath('/consolidados');
  revalidatePath('/dashboard');
  revalidatePath('/entregas');
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/clientes/${clientId}/estado-de-cuenta`);
  revalidatePath('/portal', 'layout');
}

const METHODS: PaymentMethod[] = ['TRANSFER', 'CARD', 'CASH', 'ONLINE', 'OTHER'];

/** Pago registrado por Shop USA (ya verificado). Se reparte solo entre los cargos del cliente. */
export const registerPayment = safe(async function registerPayment(input: {
  clientId: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string;
  proofUrl?: string;
  note?: string;
  /** Opcional: factura que el pago debe cubrir primero. Si no se indica, se aplica al saldo más antiguo. */
  targetInvoiceId?: string | null;
}) {
  const user = await requireStaff();
  if (!METHODS.includes(input.method)) throw new Error('Método de pago inválido');
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true, tenantId: true, name: true, email: true } });
  if (!client) throw new Error('Cliente no encontrado');

  const payment = await inTransaction(async (tx) => {
    const p = await createPayment(tx, {
      tenantId: client.tenantId,
      clientId: client.id,
      amount: input.amount,
      method: input.method,
      source: 'STAFF',
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      reference: input.reference,
      proofUrl: input.proofUrl,
      note: input.note,
      targetInvoiceId: input.targetInvoiceId,
      approved: true,
      verifiedBy: user.name,
    });
    await audit(tx, { userName: user.name, action: 'payment.register', entity: 'Payment', entityId: p.id, data: { amount: p.amount } });
    return p;
  });

  if (client.email) {
    const acc = await getClientAccount(prisma, client.id);
    await sendPaymentApprovedEmail({ to: client.email, clientName: client.name, amount: payment.amount, credit: acc.credit });
  }
  revalidateFinance(client.id);
  return { success: true };
});

/** Aprobar un comprobante: el dinero ya está en la cuenta de Shop USA y se aplica a la cuenta del cliente. */
export const approvePayment = safe(async function approvePayment(paymentId: string, amount?: number) {
  const user = await requireStaff();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { client: { select: { id: true, name: true, email: true } } } });
  if (!payment) throw new Error('Pago no encontrado');
  if (payment.status !== 'PENDING_VERIFICATION') throw new Error('Este pago ya fue procesado');
  const approvedAmount = amount && amount > 0 ? fromCents(toCents(amount)) : payment.amount;

  await inTransaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'APPROVED', amount: approvedAmount, verifiedBy: user.name, verifiedAt: new Date() },
    });
    await reconcileClient(tx, payment.clientId);
    await refreshClientOrders(tx, payment.clientId);
    await audit(tx, { userName: user.name, action: 'payment.approve', entity: 'Payment', entityId: paymentId, data: { declared: payment.amount, approved: approvedAmount } });
  });

  if (payment.client.email) {
    const acc = await getClientAccount(prisma, payment.clientId);
    await sendPaymentApprovedEmail({ to: payment.client.email, clientName: payment.client.name, amount: approvedAmount, credit: acc.credit });
  }
  revalidateFinance(payment.clientId);
  return { success: true };
});

export const rejectPayment = safe(async function rejectPayment(paymentId: string, reason: string) {
  const user = await requireStaff();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { client: { select: { id: true, name: true, email: true } } } });
  if (!payment) throw new Error('Pago no encontrado');
  if (payment.status !== 'PENDING_VERIFICATION') throw new Error('Este pago ya fue procesado');

  await inTransaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'REJECTED', rejectionReason: reason?.trim() || null, verifiedBy: user.name, verifiedAt: new Date() },
    });
    await refreshClientOrders(tx, payment.clientId);
    await audit(tx, { userName: user.name, action: 'payment.reject', entity: 'Payment', entityId: paymentId, data: { reason } });
  });

  if (payment.client.email) {
    await sendPaymentRejectedEmail({ to: payment.client.email, clientName: payment.client.name, amount: payment.amount, reason });
  }
  revalidateFinance(payment.clientId);
  return { success: true };
});

export const voidPaymentAction = safe(async function voidPaymentAction(paymentId: string) {
  const user = await requireAdmin();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { clientId: true, status: true } });
  if (!payment) throw new Error('Pago no encontrado');
  if (payment.status !== 'APPROVED') throw new Error('Solo se pueden anular pagos aprobados');
  await inTransaction((tx) => voidPayment(tx, paymentId, user.name));
  revalidateFinance(payment.clientId);
  return { success: true };
});

/** Crédito a favor del cliente (ajuste, compensación). Se aplica solo a sus cargos pendientes. */
export const grantCredit = safe(async function grantCredit(input: { clientId: string; amount: number; note: string }) {
  const user = await requireStaff();
  if (!input.note?.trim()) throw new Error('Indica el motivo del crédito');
  const tenantId = await getTenantId();
  await inTransaction(async (tx) => {
    const p = await createPayment(tx, {
      tenantId,
      clientId: input.clientId,
      amount: input.amount,
      method: 'CREDIT',
      kind: 'CREDIT_ADJUSTMENT',
      source: 'STAFF',
      note: input.note.trim(),
      approved: true,
      verifiedBy: user.name,
    });
    await audit(tx, { userName: user.name, action: 'credit.grant', entity: 'Payment', entityId: p.id, data: { amount: input.amount, note: input.note } });
  });
  revalidateFinance(input.clientId);
  return { success: true };
});

/** Cargo manual en la cuenta del cliente, con tax y tasa de servicio opcionales. */
export const createManualCharge = safe(async function createManualCharge(input: {
  clientId: string;
  description: string;
  amount: number;
  applyTax?: boolean;
  applyServiceFee?: boolean;
}) {
  const user = await requireStaff();
  if (!input.description?.trim()) throw new Error('Describe el cargo');
  if (!(input.amount > 0)) throw new Error('El monto debe ser mayor a cero');

  const settings = await getSettings();
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true, tenantId: true, serviceFeePercent: true } });
  if (!client) throw new Error('Cliente no encontrado');

  const baseCents = toCents(input.amount);
  const taxCents = input.applyTax ? pctOfCents(baseCents, settings.taxRatePercent) : 0;
  const serviceCents = input.applyServiceFee ? pctOfCents(baseCents + taxCents, client.serviceFeePercent) : 0;

  await inTransaction(async (tx) => {
    const lines = [{ kind: 'EXTRA' as InvoiceLineKind, description: input.description.trim(), amount: fromCents(baseCents) }];
    if (taxCents > 0) lines.push({ kind: 'TAX', description: `Tax ${settings.taxRatePercent}%`, amount: fromCents(taxCents) });
    if (serviceCents > 0) lines.push({ kind: 'SERVICE_FEE', description: `Servicio ${client.serviceFeePercent}%`, amount: fromCents(serviceCents) });
    const invoice = await createInvoice(tx, {
      tenantId: client.tenantId,
      clientId: client.id,
      type: 'OTHER',
      description: input.description.trim(),
      lines,
    });
    await reconcileClient(tx, client.id);
    await audit(tx, { userName: user.name, action: 'invoice.manual', entity: 'Invoice', entityId: invoice.id });
  });
  revalidateFinance(client.id);
  return { success: true };
});

/** Agrega un cargo extra o un descuento (monto negativo) a una factura existente. */
export const addInvoiceLine = safe(async function addInvoiceLine(input: { invoiceId: string; description: string; amount: number; kind?: 'EXTRA' | 'DISCOUNT' | 'ADJUSTMENT' }) {
  const user = await requireStaff();
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, include: { lines: true } });
  if (!invoice) throw new Error('Factura no encontrada');
  if (invoice.status === 'CANCELLED') throw new Error('La factura está anulada');
  if (!input.description?.trim() || !Number.isFinite(input.amount) || input.amount === 0) throw new Error('Describe el concepto e indica un monto');

  const amount = fromCents(toCents(input.amount));
  const kind: InvoiceLineKind = input.kind ?? (amount < 0 ? 'DISCOUNT' : 'EXTRA');
  const newTotal = fromCents(invoice.lines.reduce((s, l) => s + toCents(l.amount), 0) + toCents(amount));
  if (newTotal < 0) throw new Error('El descuento supera el total de la factura');

  await inTransaction(async (tx) => {
    await tx.invoiceLine.create({
      data: { invoiceId: invoice.id, kind, description: input.description.trim(), amount, sortOrder: invoice.lines.length },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { total: newTotal } });
    await reconcileClient(tx, invoice.clientId);
    await audit(tx, { userName: user.name, action: 'invoice.line', entity: 'Invoice', entityId: invoice.id, data: { amount, description: input.description } });
  });
  revalidateFinance(invoice.clientId);
  return { success: true };
});

export const cancelInvoiceAction = safe(async function cancelInvoiceAction(invoiceId: string) {
  const user = await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { clientId: true, orderId: true, consolidationId: true } });
  if (!invoice) throw new Error('Factura no encontrada');
  if (invoice.orderId) throw new Error('Las facturas de pedidos se anulan cancelando el pedido');
  if (invoice.consolidationId) throw new Error('La factura de despacho se anula reabriendo el consolidado');
  await inTransaction(async (tx) => {
    await cancelInvoice(tx, invoiceId);
    await audit(tx, { userName: user.name, action: 'invoice.cancel', entity: 'Invoice', entityId: invoiceId });
  });
  revalidateFinance(invoice.clientId);
  return { success: true };
});
