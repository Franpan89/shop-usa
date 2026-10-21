'use server';

import { safe } from '@/lib/action';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requirePortalClient, requireStaff } from '@/lib/auth';
import { sendAccessLink } from '@/lib/authLinks';
import { audit, getSettings, inTransaction } from '@/lib/tenant';
import { createPayment, refreshClientOrders } from '@/lib/accounting';
import { applyDispatchDecision } from '@/lib/consolidation';

export const invitePortalClient = safe(async function invitePortalClient(clientId: string) {
  await requireStaff();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Cliente no encontrado');
  if (!client.email) throw new Error('El cliente no tiene un correo guardado');

  await sendAccessLink({ email: client.email, name: client.name, purpose: 'invite' });

  return { success: true };
});

/**
 * El cliente decide RETENER o DESPACHAR su consolidado completo (3.9).
 * Solo puede hacerlo antes de la fecha y hora límite semanal (3.10 / 3.11) y mientras no esté cerrado.
 */
export const portalSetDecision = safe(async function portalSetDecision(consolidationId: string, decision: 'DISPATCH' | 'HOLD') {
  const client = await requirePortalClient();
  const consolidation = await prisma.consolidation.findUnique({ where: { id: consolidationId } });
  // La propiedad se valida con la sesión, nunca con datos que envíe el navegador.
  if (!consolidation || consolidation.clientId !== client.id) throw new Error('Consolidado no encontrado');

  const settings = await getSettings();
  if (settings.dispatchCutoffAt && settings.dispatchCutoffAt.getTime() < Date.now()) {
    throw new Error('El cierre semanal ya pasó. Escríbenos por WhatsApp si necesitas un cambio.');
  }
  await applyDispatchDecision(consolidationId, decision, `Cliente ${client.name}`);
  return { success: true };
});

/**
 * "YA REALICÉ MI TRANSFERENCIA": el cliente declara su pago y sube el comprobante.
 * Queda POR VERIFICAR; Shop USA confirma que el dinero está en la cuenta antes de aprobarlo.
 */
export const portalSubmitTransfer = safe(async function portalSubmitTransfer(input: {
  amount: number;
  paidAt?: string;
  reference?: string;
  proofPath: string;
  targetInvoiceId?: string | null;
  note?: string;
}) {
  const client = await requirePortalClient();
  if (!input.proofPath?.trim()) throw new Error('Sube el comprobante de tu transferencia');
  if (!(input.amount > 0)) throw new Error('Indica el monto transferido');

  if (input.targetInvoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: input.targetInvoiceId }, select: { clientId: true } });
    if (!invoice || invoice.clientId !== client.id) throw new Error('Factura inválida');
  }
  const row = await prisma.client.findUnique({ where: { id: client.id }, select: { tenantId: true } });
  if (!row) throw new Error('Cliente no encontrado');

  await inTransaction(async (tx) => {
    const payment = await createPayment(tx, {
      tenantId: row.tenantId,
      clientId: client.id,
      amount: input.amount,
      method: 'TRANSFER',
      source: 'CLIENT',
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      reference: input.reference,
      proofUrl: input.proofPath,
      note: input.note,
      targetInvoiceId: input.targetInvoiceId,
      approved: false,
    });
    await refreshClientOrders(tx, client.id);
    await audit(tx, { userName: `Cliente ${client.name}`, action: 'payment.submit', entity: 'Payment', entityId: payment.id, data: { amount: input.amount } });
  });

  revalidatePath('/pagos');
  revalidatePath('/pedidos');
  revalidatePath('/dashboard');
  revalidatePath('/portal', 'layout');
  return { success: true };
});
