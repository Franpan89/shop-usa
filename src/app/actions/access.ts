'use server';

import { revalidatePath } from 'next/cache';
import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { assertEmailFree } from '@/lib/clientAccess';
import { isValidEmail, normalizeClientCode } from '@/lib/domain/access';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, getTenantId, inTransaction } from '@/lib/tenant';

const str = (formData: FormData, key: string) => ((formData.get(key) as string | null) ?? '').trim();

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Máximo de solicitudes nuevas por hora en todo el sistema: tope contra quien llene la bandeja de basura.
const MAX_REQUESTS_PER_HOUR = 30;

/**
 * PÚBLICA a propósito (la usa quien aún no tiene cuenta): se trata como un endpoint abierto.
 * Solo crea una solicitud PENDIENTE; no liga ningún correo ni da acceso. Eso lo decide el personal
 * en `approveAccessRequest`, comparando el código, el teléfono y el correo que declaró la persona.
 */
export const requestPortalAccess = safe(async function requestPortalAccess(formData: FormData) {
  const code = normalizeClientCode(str(formData, 'code'));
  const email = str(formData, 'email').toLowerCase();
  const phone = str(formData, 'phone').slice(0, 40);

  if (!code) throw new Error('Escribe tu código de cliente, por ejemplo EC001');
  if (!isValidEmail(email)) throw new Error('Escribe un correo válido');
  if (phone.replace(/\D/g, '').length < 7) throw new Error('Escribe el teléfono que registraste con nosotros');

  const tenantId = await getTenantId();
  const client = await prisma.client.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (!client) throw new Error('No encontramos ese código. Revisa que esté bien escrito o escríbenos por WhatsApp.');

  if (client.email) {
    throw new Error(
      client.email === email
        ? 'Este código ya tiene acceso. Inicia sesión; si olvidaste tu contraseña, usa “Olvidé mi contraseña”.'
        : 'Este código ya tiene un correo registrado. Escríbenos por WhatsApp si necesitas cambiarlo.',
    );
  }
  await assertEmailFree(email);

  const recent = await prisma.accessRequest.count({ where: { createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_REQUESTS_PER_HOUR) throw new Error('Hay muchas solicitudes en este momento. Intenta de nuevo en un rato.');

  const open = await prisma.accessRequest.findFirst({
    where: { status: 'PENDING', OR: [{ clientId: client.id }, { email }] },
    select: { clientId: true },
  });
  if (open) {
    throw new Error(
      open.clientId === client.id
        ? 'Ya recibimos tu solicitud y está en revisión. Te avisaremos al correo cuando esté aprobada.'
        : 'Ese correo ya está en una solicitud en revisión. Usa otro correo.',
    );
  }

  await prisma.accessRequest.create({ data: { tenantId, clientId: client.id, email, phone } });
  revalidatePath('/accesos');
  return { success: true };
});

/**
 * Aprobar = ligar el correo al código y enviar la invitación para crear la contraseña.
 * El correo solo queda ligado si la invitación salió, y la persona solo entra tras abrir ese enlace
 * (así se comprueba que es dueña del correo). Sin sesión de staff no hace nada.
 */
export const approveAccessRequest = safe(async function approveAccessRequest(id: string) {
  const user = await requireStaff();

  const request = await prisma.accessRequest.findUnique({ where: { id }, include: { client: true } });
  if (!request || request.status !== 'PENDING') throw new Error('Esta solicitud ya fue atendida');
  if (request.client.email) throw new Error('Este cliente ya tiene un correo registrado');
  await assertEmailFree(request.email, request.clientId);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(request.email, {
    redirectTo: `${SITE()}/auth/callback?next=/set-password`,
  });
  if (error) {
    throw new Error(
      /already|registered|exists/i.test(error.message)
        ? 'Ese correo ya tiene una cuenta en el sistema. Pídele otro correo o revisa Supabase Auth.'
        : `No se pudo enviar la invitación: ${error.message}`,
    );
  }

  await inTransaction(async (tx) => {
    // Condición `email: null` + unicidad: si dos aprobaciones corren a la vez, solo una gana.
    const linked = await tx.client.updateMany({ where: { id: request.clientId, email: null }, data: { email: request.email } });
    if (linked.count !== 1) throw new Error('Este cliente ya tiene un correo registrado');
    await tx.accessRequest.update({ where: { id }, data: { status: 'APPROVED', decidedBy: user.name, decidedAt: new Date() } });
    await audit(tx, { userName: user.name, action: 'access.approve', entity: 'Client', entityId: request.clientId, data: { email: request.email } });
  });

  revalidatePath('/accesos');
  revalidatePath(`/clientes/${request.clientId}`);
  return { success: true };
});

export const rejectAccessRequest = safe(async function rejectAccessRequest(id: string, reason?: string) {
  const user = await requireStaff();
  const request = await prisma.accessRequest.findUnique({ where: { id } });
  if (!request || request.status !== 'PENDING') throw new Error('Esta solicitud ya fue atendida');

  await inTransaction(async (tx) => {
    await tx.accessRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectReason: reason?.trim() || null, decidedBy: user.name, decidedAt: new Date() },
    });
    await audit(tx, { userName: user.name, action: 'access.reject', entity: 'Client', entityId: request.clientId });
  });

  revalidatePath('/accesos');
  return { success: true };
});

/**
 * PÚBLICA: "Olvidé mi contraseña". Responde siempre igual, exista o no el correo, para no revelar
 * quién es cliente. Solo se envía a correos ligados a un cliente o a una cuenta del equipo.
 */
export const requestPasswordReset = safe(async function requestPasswordReset(formData: FormData) {
  const email = str(formData, 'email').toLowerCase();
  if (!isValidEmail(email)) throw new Error('Escribe un correo válido');

  const [staff, client] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.client.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (staff || client) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE()}/auth/callback?next=/set-password` });
  }
  return { success: true };
});
