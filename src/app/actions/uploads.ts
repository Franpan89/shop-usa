'use server';

import { safe } from '@/lib/action';
import { getCurrentUser } from '@/lib/auth';
import { createUploadTarget } from '@/lib/storage';

/**
 * Prepara una subida directa a Supabase Storage (el archivo viaja del navegador al bucket,
 * sin pasar por el límite de tamaño de las Server Actions).
 * - Fotos de producto: solo personal de Shop USA.
 * - Comprobantes de pago: personal o el propio cliente desde su portal.
 */
export const requestUpload = safe(async function requestUpload(kind: 'product' | 'proof', ext: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sesión expirada');
  if (kind === 'product' && user.kind !== 'staff') throw new Error('No autorizado');
  return createUploadTarget(kind, ext);
});
