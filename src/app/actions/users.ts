'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { sendAccessLink } from '@/lib/authLinks';
import { revalidatePath } from 'next/cache';

export const createStaffUser = safe(async function createStaffUser(formData: FormData) {
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

  await sendAccessLink({ email, name, purpose: 'invite' });

  await prisma.user.create({
    data: { tenantId: tenant.id, name, email, role },
  });

  revalidatePath('/usuarios');
  return { success: true };
});
