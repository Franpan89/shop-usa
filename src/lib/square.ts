import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cliente mínimo de la API de Square (sin SDK). Se usa solo el Checkout (enlace de pago):
 * el cliente paga en la página de Square y nunca vemos ni guardamos datos de tarjeta.
 *
 * Variables de entorno:
 *   SQUARE_ACCESS_TOKEN         token de acceso de la aplicación
 *   SQUARE_LOCATION_ID          ubicación que recibe el dinero
 *   SQUARE_ENVIRONMENT          "production" o "sandbox" (por defecto sandbox: nunca cobra de verdad por accidente)
 *   SQUARE_WEBHOOK_SIGNATURE_KEY  clave de firma de la suscripción de webhooks
 *   SQUARE_WEBHOOK_URL          (opcional) URL exacta registrada en Square si difiere de NEXT_PUBLIC_SITE_URL
 */
const API_VERSION = '2024-12-18';

function config() {
  return {
    token: process.env.SQUARE_ACCESS_TOKEN ?? '',
    locationId: process.env.SQUARE_LOCATION_ID ?? '',
    production: process.env.SQUARE_ENVIRONMENT === 'production',
    webhookKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? '',
  };
}

export function isSquareConfigured(): boolean {
  const c = config();
  return !!c.token && !!c.locationId;
}

export function webhookUrl(): string {
  return process.env.SQUARE_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/square/webhook`;
}

class SquareError extends Error {
  constructor(message: string, readonly codes: string[]) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const c = config();
  if (!c.token) throw new Error('Square no está configurado');
  const base = c.production ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
      'Square-Version': API_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { errors?: { code: string; detail?: string }[] };
  if (!res.ok) {
    console.error('[square]', method, path, res.status, JSON.stringify(json.errors ?? json));
    throw new SquareError('No se pudo comunicar con Square', (json.errors ?? []).map((e) => e.code));
  }
  return json;
}

/** Crea el enlace de pago de Square por un monto exacto. `checkoutId` es la llave de idempotencia y la referencia. */
export async function createPaymentLink(p: {
  checkoutId: string;
  cents: number;
  description: string;
  redirectUrl: string;
  buyerEmail?: string;
}): Promise<{ linkId: string; orderId: string; url: string }> {
  const c = config();
  const send = (buyerEmail?: string) =>
    call<{ payment_link?: { id: string; url: string; order_id: string } }>('POST', '/v2/online-checkout/payment-links', {
      idempotency_key: p.checkoutId,
      order: {
        location_id: c.locationId,
        reference_id: p.checkoutId,
        line_items: [{ name: p.description, quantity: '1', base_price_money: { amount: p.cents, currency: 'USD' } }],
      },
      checkout_options: { redirect_url: p.redirectUrl, ask_for_shipping_address: false, allow_tipping: false },
      pre_populated_data: buyerEmail ? { buyer_email: buyerEmail } : undefined,
    });
  let json;
  try {
    json = await send(p.buyerEmail);
  } catch (err) {
    // Square rechaza correos con formato que no le gusta; el correo solo precarga el formulario, así que se reintenta sin él.
    if (p.buyerEmail && err instanceof SquareError && err.codes.includes('INVALID_EMAIL_ADDRESS')) json = await send();
    else throw err;
  }
  const link = json.payment_link;
  if (!link?.url || !link.order_id) throw new Error('Square no devolvió el enlace de pago');
  return { linkId: link.id, orderId: link.order_id, url: link.url };
}

export type SquareOrder = { state: string; totalCents: number; currency: string; paid: boolean; paymentId: string | null };

/** Estado real de la orden en Square: es lo único que se usa para dar un pago por cobrado (nunca el aviso en bruto). */
export async function getOrder(orderId: string): Promise<SquareOrder> {
  const json = await call<{
    order?: {
      state: string;
      total_money?: { amount: number; currency: string };
      net_amount_due_money?: { amount: number };
      tenders?: { id: string; payment_id?: string }[];
    };
  }>('GET', `/v2/orders/${encodeURIComponent(orderId)}`);
  const o = json.order;
  if (!o) throw new Error('Square no devolvió la orden');
  const tender = o.tenders?.[0];
  const paid = o.state === 'COMPLETED' || (!!tender && o.net_amount_due_money?.amount === 0);
  return {
    state: o.state,
    totalCents: o.total_money?.amount ?? 0,
    currency: o.total_money?.currency ?? '',
    paid,
    paymentId: tender ? tender.payment_id ?? tender.id : null,
  };
}

/** Firma del webhook: base64(HMAC-SHA256(clave, URL de notificación + cuerpo en bruto)). */
export function verifyWebhookSignature(p: { body: string; signature: string | null; url: string; key: string }): boolean {
  if (!p.signature || !p.key) return false;
  const expected = createHmac('sha256', p.key).update(p.url + p.body).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(p.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function webhookKey(): string {
  return config().webhookKey;
}
