'use server';

import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function createStaffUser(formData: FormData) {
  await requireAdmin();

  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const role = formData.get('role') as string;
  if (!name || !email || (role !== 'ADMIN' && role !== 'SUBADMIN')) {
    throw new Error('Datos inválidos');
  }

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Ya existe un usuario con ese correo');

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });
  if (error) throw new Error(`No se pudo invitar al usuario: ${error.message}`);

  await prisma.user.create({
    data: { tenantId: tenant.id, name, email, role },
  });

  revalidatePath('/usuarios');
  return { success: true };
}
