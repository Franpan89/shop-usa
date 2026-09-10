import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || 'ShopUSA <onboarding@resend.dev>';

async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — se omitió el envío a ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // A failed notification should never block the order/box status change that triggered it.
    console.error(`[email] Error enviando a ${to}:`, err);
  }
}

const wrapper = (title: string, body: string) => `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #6366f1; margin-bottom: 4px;">ShopUSA</h2>
    <h3 style="margin-top: 0;">${title}</h3>
    ${body}
    <p style="color: #888; font-size: 0.8rem; margin-top: 32px;">Este es un correo automático de ShopUSA.</p>
  </div>
`;

export async function sendOrderShippedEmail(params: {
  to: string;
  clientName: string;
  orderRef: string;
  products: { name: string; weight: number }[];
  boxLabel?: string;
}) {
  const { to, clientName, orderRef, products, boxLabel } = params;
  const itemsHtml = products.map((p) => `<li>${p.name} — ${p.weight.toFixed(2)} lbs</li>`).join('');

  await sendMail({
    to,
    subject: `Tu pedido ${orderRef} fue enviado`,
    html: wrapper('📦 Tu pedido está en camino', `
      <p>Hola ${clientName},</p>
      <p>Tu pedido <strong>${orderRef}</strong>${boxLabel ? ` (caja ${boxLabel})` : ''} ya fue enviado. Estos son los productos incluidos:</p>
      <ul>${itemsHtml}</ul>
      <p>Te avisaremos cuando llegue y esté listo para retirar.</p>
    `),
  });
}

export async function sendBoxArrivedEmail(params: {
  to: string;
  clientName: string;
  products: { name: string; weight: number }[];
}) {
  const { to, clientName, products } = params;
  const itemsHtml = products.map((p) => `<li>${p.name} — ${p.weight.toFixed(2)} lbs</li>`).join('');

  await sendMail({
    to,
    subject: `Tus productos ya están listos para retirar`,
    html: wrapper('✅ Listo para retirar', `
      <p>Hola ${clientName},</p>
      <p>Tus productos ya llegaron y están listos para retirar:</p>
      <ul>${itemsHtml}</ul>
    `),
  });
}
