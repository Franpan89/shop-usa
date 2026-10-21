import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAuthLinkEmail } from '@/lib/email';

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

type LinkType = 'invite' | 'recovery';

async function generateToken(email: string, type: LinkType) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type, email });
  return { token: data?.properties?.hashed_token ?? null, error };
}

/**
 * Envía por Resend (con la marca de ShopUSA, en español) el enlace para crear o cambiar la contraseña.
 * Supabase solo genera el token: no manda ningún correo ni redirige, así que no depende de su SMTP
 * (límite de envíos por hora) ni de la lista de URLs permitidas.
 *
 * `invite` crea la cuenta si no existe; `recovery` solo sirve si ya existe. Si la preferida no aplica
 * se prueba la otra, para que "reenviar invitación" y "olvidé mi contraseña" funcionen en ambos casos.
 * El enlace apunta a /auth/confirm, que pide un clic antes de consumir el token (los antivirus de
 * correo que abren enlaces por su cuenta no lo gastan).
 */
export async function sendAccessLink(p: { email: string; name?: string | null; purpose: 'invite' | 'reset' }) {
  const order: LinkType[] = p.purpose === 'invite' ? ['invite', 'recovery'] : ['recovery', 'invite'];
  let result = await generateToken(p.email, order[0]);
  let type = order[0];
  if (!result.token) {
    result = await generateToken(p.email, order[1]);
    type = order[1];
  }
  if (!result.token) throw new Error(`No se pudo generar el enlace de acceso: ${result.error?.message ?? 'sin respuesta'}`);

  const url = `${SITE()}/auth/confirm?token_hash=${encodeURIComponent(result.token)}&type=${type}`;
  await sendAuthLinkEmail({ to: p.email, name: p.name, url, purpose: p.purpose });
}
