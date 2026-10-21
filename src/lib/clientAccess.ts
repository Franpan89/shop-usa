import 'server-only';
import prisma from '@/lib/prisma';

/**
 * Un correo identifica a una sola persona en todo el sistema: la sesión se resuelve por correo
 * (primero personal, luego cliente), así que un correo repetido entre equipo y clientes —o entre
 * dos clientes— daría acceso a la cuenta equivocada. Se valida aquí, en un único lugar.
 */
export async function assertEmailFree(email: string, exceptClientId?: string): Promise<void> {
  const [staff, client] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.client.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (staff) throw new Error('Ese correo pertenece a una cuenta del equipo de Shop USA');
  if (client && client.id !== exceptClientId) throw new Error('Ese correo ya está asociado a otro cliente');
}
