import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || 'ShopUSA <onboarding@resend.dev>';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — se omitió el envío a ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // Una notificación fallida nunca debe bloquear el cambio de estado que la originó.
    console.error(`[email] Error enviando a ${to}:`, err);
  }
}

/**
 * Igual que sendMail pero SIN tragarse el error: los correos de acceso (invitación, cambio de contraseña)
 * son el único camino del cliente para entrar, así que si no salen hay que decírselo a quien lo pidió.
 */
async function sendMailOrThrow({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) throw new Error('El envío de correos no está configurado (falta RESEND_API_KEY)');
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error(`[email] Error enviando a ${to}:`, error);
    throw new Error('No se pudo enviar el correo. Revisa que el dominio de envío esté verificado en Resend.');
  }
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const wrapper = (title: string, body: string, accountLink = true) => `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #fa7e9f; margin-bottom: 4px;">ShopUSA</h2>
    <h3 style="margin-top: 0;">${title}</h3>
    ${body}
    ${accountLink ? `<p style="margin-top: 24px;"><a href="${SITE}/portal" style="color: #fa7e9f; font-weight: 600;">Ver mi cuenta en ShopUSA</a></p>` : ''}
    <p style="color: #888; font-size: 0.8rem; margin-top: 32px;">Este es un correo automático de ShopUSA.</p>
  </div>
`;

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
const money = (n: number) => `$${n.toFixed(2)}`;

/** Enlace para crear o cambiar la contraseña. Lanza si no se pudo enviar. */
export async function sendAuthLinkEmail(p: { to: string; name?: string | null; url: string; purpose: 'invite' | 'reset' }) {
  const invite = p.purpose === 'invite';
  const button = `<p style="margin: 24px 0;"><a href="${esc(p.url)}" style="background: #fa7e9f; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">${invite ? 'Crear mi contraseña' : 'Cambiar mi contraseña'}</a></p>`;
  await sendMailOrThrow({
    to: p.to,
    subject: invite ? 'Activa tu acceso a ShopUSA' : 'Cambia tu contraseña de ShopUSA',
    html: wrapper(
      invite ? '🎉 Tu acceso fue aprobado' : '🔑 Cambia tu contraseña',
      `<p>Hola${p.name ? ` ${esc(p.name.split(' ')[0])}` : ''},</p>
       <p>${invite ? 'Aprobamos tu acceso al portal de ShopUSA. Con el botón de abajo creas tu contraseña y entras a ver tu mercancía, tus pedidos y tu estado de cuenta.' : 'Recibimos una solicitud para cambiar la contraseña de tu cuenta de ShopUSA.'}</p>
       ${button}
       <p style="color: #666; font-size: 0.85rem;">El enlace se puede usar una sola vez y vence pronto. ${invite ? '' : 'Si no lo pediste tú, ignora este correo: tu contraseña no cambia.'}</p>`,
      false,
    ),
  });
}

export async function sendPaymentApprovedEmail(p: { to: string; clientName: string; amount: number; credit: number }) {
  await sendMail({
    to: p.to,
    subject: 'Recibimos y aprobamos tu pago',
    html: wrapper(
      '✅ Pago aprobado',
      `<p>Hola ${esc(p.clientName)},</p>
       <p>Verificamos tu pago de <strong>${money(p.amount)}</strong> y ya está aplicado a tu cuenta.</p>
       ${p.credit > 0 ? `<p>Te quedó un saldo a favor de <strong>${money(p.credit)}</strong>; lo usaremos en tu próximo cargo.</p>` : ''}`,
    ),
  });
}

export async function sendPaymentRejectedEmail(p: { to: string; clientName: string; amount: number; reason?: string | null }) {
  await sendMail({
    to: p.to,
    subject: 'No pudimos verificar tu pago',
    html: wrapper(
      '⚠️ Pago no verificado',
      `<p>Hola ${esc(p.clientName)},</p>
       <p>No pudimos verificar tu comprobante de <strong>${money(p.amount)}</strong>.</p>
       ${p.reason ? `<p>Motivo: ${esc(p.reason)}</p>` : ''}
       <p>Por favor revisa los datos y vuelve a subir tu comprobante desde tu cuenta.</p>`,
    ),
  });
}

export async function sendShippedEmail(p: { to: string; clientName: string; products: string[] }) {
  await sendMail({
    to: p.to,
    subject: 'Tu mercancía va en camino',
    html: wrapper(
      '🚚 Tu mercancía está en tránsito',
      `<p>Hola ${esc(p.clientName)},</p>
       <p>Estos productos salieron de Estados Unidos y ya van en camino:</p>
       ${list(p.products)}
       <p>Te avisaremos cuando estén listos para retirar.</p>`,
    ),
  });
}

export async function sendReadyForPickupEmail(p: { to: string; clientName: string; products: string[]; balance: number }) {
  await sendMail({
    to: p.to,
    subject: 'Tus productos están listos para retirar',
    html: wrapper(
      '✅ Listo para retirar',
      `<p>Hola ${esc(p.clientName)},</p>
       <p>Estos productos ya llegaron y están listos para retirar:</p>
       ${list(p.products)}
       ${p.balance > 0 ? `<p><strong>Tienes un saldo pendiente de ${money(p.balance)} de este despacho.</strong> Para poder entregarte la mercancía debe estar cancelado.</p>` : ''}`,
    ),
  });
}

export async function sendRetentionAlertEmail(p: {
  to: string;
  clientName: string;
  days: number;
  maxDays: number;
  level: 'warning' | 'overdue';
}) {
  await sendMail({
    to: p.to,
    subject: p.level === 'overdue' ? 'Tu mercancía cumplió el período de retención' : 'Tu mercancía lleva varios días retenida',
    html: wrapper(
      '⏳ Retención de mercancía',
      `<p>Hola ${esc(p.clientName)},</p>
       <p>Tu mercancía lleva <strong>${p.days} días</strong> retenida en Shop USA. La mercancía puede mantenerse en consolidación por un período máximo aproximado de ${p.maxDays} días.</p>
       <p>${p.level === 'overdue' ? 'Shop USA podrá solicitar el despacho de tu mercancía para evitar acumulaciones prolongadas en bodega.' : 'Si ya quieres que la despachemos, entra a tu cuenta y elige “Despachar”.'}</p>`,
    ),
  });
}
