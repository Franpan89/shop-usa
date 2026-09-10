'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function signIn(formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;
  if (!email || !password) return { error: 'Ingresa correo y contraseña' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Correo o contraseña incorrectos' };

  const staff = await prisma.user.findUnique({ where: { email } });
  if (staff) redirect('/');

  const client = await prisma.client.findUnique({ where: { email } });
  if (client) redirect('/portal');

  // Authenticated with Supabase but not recognized in our app — don't leave a dangling session.
  await supabase.auth.signOut();
  return { error: 'Esta cuenta no está habilitada en el sistema' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
