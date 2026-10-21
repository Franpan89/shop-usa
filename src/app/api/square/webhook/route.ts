import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { finalizeCardCheckout } from '@/lib/cardPayments';
import { verifyWebhookSignature, webhookKey, webhookUrl } from '@/lib/square';

export const dynamic = 'force-dynamic';

type SquareEvent = {
  type?: string;
  data?: { object?: { payment?: { order_id?: string }; order_updated?: { order_id?: string }; order_created?: { order_id?: string } } };
};

/**
 * Aviso de Square cuando cambia un pago u orden. Sin sesión (lo llama Square): se protege con la firma
 * HMAC del cuerpo. Aun con firma válida no se confía en el contenido: finalizeCardCheckout consulta a
 * Square el estado real de la orden antes de registrar nada.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const valid = verifyWebhookSignature({ body, signature: request.headers.get('x-square-hmacsha256-signature'), url: webhookUrl(), key: webhookKey() });
  if (!valid) return NextResponse.json({ error: 'firma inválida' }, { status: 401 });

  let event: SquareEvent;
  try {
    event = JSON.parse(body) as SquareEvent;
  } catch {
    return NextResponse.json({ error: 'cuerpo inválido' }, { status: 400 });
  }

  const obj = event.data?.object;
  const orderId = obj?.payment?.order_id ?? obj?.order_updated?.order_id ?? obj?.order_created?.order_id;
  if (orderId) {
    const checkout = await prisma.cardCheckout.findUnique({ where: { squareOrderId: orderId }, select: { id: true } });
    if (checkout) {
      try {
        await finalizeCardCheckout(checkout.id);
      } catch (err) {
        // Responder error hace que Square reintente el aviso más tarde.
        console.error('[square webhook]', err);
        return NextResponse.json({ error: 'no se pudo procesar' }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
