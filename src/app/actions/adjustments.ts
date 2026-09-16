'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Kept in sync with the TAX_RATE used for orders in actions/orders.ts.
const TAX_RATE = 0.065;

export async function createAdjustment(clientId: string, formData: FormData) {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('Tenant no encontrado');

  const date = new Date(formData.get('date') as string);
  const type = formData.get('type') as 'CARGO' | 'CREDITO';
  const description = formData.get('description') as string;
  const baseAmount = parseFloat(formData.get('amount') as string);
  const applyTax = formData.get('applyTax') === 'on';
  const applyServiceFee = formData.get('applyServiceFee') === 'on';

  const rows: { tenantId: string; clientId: string; date: Date; type: 'CARGO' | 'CREDITO'; description: string; amount: number }[] = [
    { tenantId: tenant.id, clientId, date, type, description, amount: baseAmount },
  ];

  // Tax/service fee only make sense as add-ons to a charge, never to a credit.
  if (type === 'CARGO' && (applyTax || applyServiceFee)) {
    const taxAmount = applyTax ? parseFloat((baseAmount * TAX_RATE).toFixed(2)) : 0;
    if (taxAmount > 0) {
      rows.push({
        tenantId: tenant.id,
        clientId,
        date,
        type,
        description: `Impuesto (${(TAX_RATE * 100).toFixed(1)}%) — ${description}`,
        amount: taxAmount,
      });
    }

    if (applyServiceFee) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { serviceFeePercent: true },
      });
      const feePercent = client?.serviceFeePercent ?? 20;
      const serviceFeeAmount = parseFloat(((baseAmount + taxAmount) * feePercent / 100).toFixed(2));
      if (serviceFeeAmount > 0) {
        rows.push({
          tenantId: tenant.id,
          clientId,
          date,
          type,
          description: `Service fee (${feePercent}%) — ${description}`,
          amount: serviceFeeAmount,
        });
      }
    }
  }

  await prisma.clientAdjustment.createMany({ data: rows });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/clientes/${clientId}/estado-de-cuenta`);
}

export async function deleteAdjustment(id: string, clientId: string) {
  await prisma.clientAdjustment.delete({ where: { id } });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/clientes/${clientId}/estado-de-cuenta`);
}
