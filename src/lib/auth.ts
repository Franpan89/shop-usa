import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export type CurrentUser =
  | { kind: 'staff'; id: string; name: string; email: string; role: 'ADMIN' | 'SUBADMIN' }
  | { kind: 'portal'; id: string; name: string; email: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const staff = await prisma.user.findUnique({ where: { email: user.email } });
  if (staff) {
    return { kind: 'staff', id: staff.id, name: staff.name, email: staff.email, role: staff.role };
  }

  const client = await prisma.client.findUnique({ where: { email: user.email } });
  if (client) {
    return { kind: 'portal', id: client.id, name: client.name, email: client.email! };
  }

  return null;
}

/** Redirects to /login if not authenticated at all. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Redirects non-staff (or unauthenticated) visitors away — use at the top of every (staff) page/layout. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.kind !== 'staff') redirect('/portal');
  return user;
}

/** Redirects anyone who isn't Admin — use for Configuraciones and Usuarios. */
export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}

/** Redirects non-portal (or unauthenticated) visitors away — use at the top of the portal layout. */
export async function requirePortalClient() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.kind !== 'portal') redirect('/');
  return user;
}
