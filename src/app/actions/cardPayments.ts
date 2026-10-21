'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { getClientAccount } from '@/lib/accounting';
import { finalizeCardCheckout } from '@/lib/cardPayments';
import { toCents } from '@/lib/domain/money';
import { createPaymentLink, isSquareConfigured } from '@/lib/square';
import { invoiceBalanceOf } from '@/lib/logistics';

const MIN_CENTS = 100; // Square rechaza montos muy pequeños y no vale la pena el cobro de menos de $1

/**
 * El cliente quiere pagar con tarjeta: se registra el intento y se devuelve el enlace de Square.
 * El cliente sale de la sesión; el monto se valida contra su saldo real en el servidor.
 */
export const createCardCheckout = safe(async function createCardCheckout(input: { amount: number; targetInvoiceId?: string | null }) {
  const me = await requirePortalClient();
  if (!isSquareConfigured()) throw new Error('El pago con tarjeta no está disponible por ahora. Usa transferencia.');

  const cents = toCents(input.amount);
  if (!Number.isFinite(cents) || cents < MIN_CENTS) throw new Error('El monto mínimo para pagar con tarjeta es $1.00');

  const account = await getClientAccount(prisma, me.id);
  if (account.pending < 0.005) throw new Error('No tienes saldo pendiente por pagar');
  let max = toCents(account.pending);

  if (input.targetInvoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: input.targetInvoiceId }, select: { clientId: true, total: true, paidAmount: true, status: true } });
    if (!invoice || invoice.clientId !== me.id || (invoice.status !== 'PENDING' && invoice.status !== 'PARTIAL')) throw new Error('Factura inválida');
    max = Math.min(max, toCents(invoiceBalanceOf(invoice)));
  }
  if (cents > max) throw new Error('El monto no puede ser mayor a lo que debes');

  // Freno: demasiados enlaces abiertos en poco tiempo suelen ser un error o un abuso.
  const recent = await prisma.cardCheckout.count({ where: { clientId: me.id, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 5) throw new Error('Ya generaste varios enlaces de pago. Espera unos minutos o usa transferencia.');

  const client = await prisma.client.findUniqueOrThrow({ where: { id: me.id }, select: { tenantId: true, code: true } });
  const checkout = await prisma.cardCheckout.create({
    data: { tenantId: client.tenantId, clientId: me.id, amount: cents / 100, targetInvoiceId: input.targetInvoiceId || null },
  });

  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const link = await createPaymentLink({
      checkoutId: checkout.id,
      cents,
      description: `Pago ShopUSA · ${client.code}`,
      redirectUrl: `${site}/portal/estado-de-cuenta?tarjeta=${checkout.id}`,
      buyerEmail: me.email,
    });
    await prisma.cardCheckout.update({ where: { id: checkout.id }, data: { squareLinkId: link.linkId, squareOrderId: link.orderId } });
    return { url: link.url };
  } catch (err) {
    await prisma.cardCheckout.update({ where: { id: checkout.id }, data: { status: 'FAILED' } });
    throw err instanceof Error ? err : new Error('No se pudo iniciar el pago con tarjeta');
  }
});

/** Cuando el cliente vuelve de Square: confirma el cobro sin esperar al webhook. Solo sobre sus propios intentos. */
export const confirmCardCheckout = safe(async function confirmCardCheckout(checkoutId: string) {
  const me = await requirePortalClient();
  const checkout = await prisma.cardCheckout.findUnique({ where: { id: checkoutId }, select: { clientId: true } });
  if (!checkout || checkout.clientId !== me.id) throw new Error('Pago no encontrado');
  const outcome = await finalizeCardCheckout(checkoutId);
  return { outcome };
});
