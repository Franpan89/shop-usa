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
  if (staff) redirect('/dashboard');

  const client = await prisma.client.findUnique({ where: { email } });
  if (client) redirect('/portal');

  // Authenticated with Supabase but not recognized in our app — don't leave a dangling session.
  await supabase.auth.signOut();
  return { error: 'Esta cuenta no está habilitada en el sistema' };
}

/**
 * Canjea el token de un enlace de invitación o de cambio de contraseña (lo llama el botón de /auth/confirm)
 * y deja la sesión abierta para que la persona elija su contraseña.
 */
export async function confirmAuthLink(tokenHash: string, type: string) {
  if ((type !== 'invite' && type !== 'recovery') || !tokenHash) return { error: 'Enlace inválido. Pide uno nuevo.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return { error: 'El enlace venció o ya se usó. Pide uno nuevo.' };
  redirect('/set-password');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
