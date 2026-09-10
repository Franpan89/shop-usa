'use server';

import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateOwnProfile(formData: FormData) {
  const currentClient = await requirePortalClient();

  const phone = (formData.get('phone') as string)?.trim();
  const deliveryMethod = formData.get('deliveryMethod') as string;
  const deliveryAddress = (formData.get('deliveryAddress') as string)?.trim();

  if (deliveryMethod !== 'STORE_PICKUP' && deliveryMethod !== 'HOME_DELIVERY') {
    throw new Error('Preferencia de entrega inválida');
  }
  if (deliveryMethod === 'HOME_DELIVERY' && !deliveryAddress) {
    throw new Error('La dirección de entrega es requerida');
  }

  // clientId is derived from the session, never from client input.
  await prisma.client.update({
    where: { id: currentClient.id },
    data: {
      phone,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'HOME_DELIVERY' ? deliveryAddress : null,
    },
  });

  revalidatePath('/portal/perfil');
  return { success: true };
}
