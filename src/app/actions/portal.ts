'use server';

import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function invitePortalClient(clientId: string) {
  await requireStaff();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Cliente no encontrado');
  if (!client.email) throw new Error('El cliente no tiene un correo guardado');

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { error } = await admin.auth.admin.inviteUserByEmail(client.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });
  if (error) throw new Error(`No se pudo invitar: ${error.message}`);

  return { success: true };
}
