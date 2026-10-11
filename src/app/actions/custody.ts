'use server';

import { safe } from '@/lib/action';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { audit, getSettings, inTransaction } from '@/lib/tenant';
import { cancelInvoice, createInvoice, reconcileClient } from '@/lib/accounting';
import { deliveryFee } from '@/lib/domain/pricing';

function revalidateCustody(clientId: string) {
  revalidatePath('/custodio');
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath('/pagos');
  revalidatePath('/portal', 'layout');
}

/**
 * El servicio está apagado por defecto. Shop USA lo activa cuando el cliente avisa que viaja a
 * Orlando, con la fecha límite que indicó; la desactivación también es manual (9.2 / 9.9).
 */
export const setCustodyActive = safe(async function setCustodyActive(clientId: string, active: boolean, deadline?: string | null) {
  const user = await requireStaff();
  if (active && !deadline) throw new Error('Indica la fecha límite de custodia del cliente');
  await prisma.client.update({
    where: { id: clientId },
    data: { custodyActive: active, custodyDeadline: active && deadline ? new Date(deadline) : active ? undefined : null },
  });
  await audit(prisma, { userName: user.name, action: active ? 'custody.activate' : 'custody.deactivate', entity: 'Client', entityId: clientId, data: { deadline } });
  revalidateCustody(clientId);
  return { success: true };
});

/**
 * Entrega de paquetes en custodia: retiro en oficina (sin cargo) o delivery
 * ($15 hasta 5 millas + $1.50 por milla adicional; configurable). El delivery
 * se agrega a la cuenta corriente del cliente.
 */
export const deliverCustodyPackages = safe(async function deliverCustodyPackages(input: {
  clientId: string;
  packageIds: string[];
  method: 'PICKUP' | 'DELIVERY';
  miles?: number;
}) {
  const user = await requireStaff();
  if (!input.packageIds?.length) throw new Error('Selecciona los paquetes a entregar');
  const settings = await getSettings();

  const packages = await prisma.custodyPackage.findMany({
    where: { id: { in: input.packageIds }, clientId: input.clientId },
    include: { client: { select: { tenantId: true } } },
  });
  if (packages.length !== input.packageIds.length) throw new Error('Algún paquete no pertenece al cliente');
  if (packages.some((p) => p.status !== 'IN_CUSTODY')) throw new Error('Algún paquete ya fue entregado');

  const miles = input.method === 'DELIVERY' ? Number(input.miles) : 0;
  if (input.method === 'DELIVERY' && (!Number.isFinite(miles) || miles < 0)) throw new Error('Indica las millas del delivery');
  const fee = input.method === 'DELIVERY'
    ? deliveryFee(miles, { baseFee: settings.deliveryBaseFee, baseMiles: settings.deliveryBaseMiles, extraPerMile: settings.deliveryExtraPerMile })
    : 0;

  await inTransaction(async (tx) => {
    let deliveryInvoiceId: string | null = null;
    if (input.method === 'DELIVERY') {
      const invoice = await createInvoice(tx, {
        tenantId: packages[0].client.tenantId,
        clientId: input.clientId,
        type: 'DELIVERY',
        description: `Delivery de custodio — ${packages.length} paquete(s), ${miles} millas`,
        lines: [{ kind: 'DELIVERY', description: `Delivery ${miles} millas`, amount: fee }],
      });
      deliveryInvoiceId = invoice.id;
    }
    await tx.custodyPackage.updateMany({
      where: { id: { in: input.packageIds } },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveryMethod: input.method,
        deliveryMiles: input.method === 'DELIVERY' ? miles : null,
        deliveryInvoiceId,
      },
    });
    // El cargo de delivery se registra una vez, en el primer paquete del viaje.
    if (input.method === 'DELIVERY') {
      await tx.custodyPackage.update({ where: { id: packages[0].id }, data: { deliveryFee: fee } });
    }
    await reconcileClient(tx, input.clientId);
    await audit(tx, { userName: user.name, action: 'custody.deliver', entity: 'Client', entityId: input.clientId, data: { method: input.method, miles, fee, count: packages.length } });
  });

  revalidateCustody(input.clientId);
  return { success: true, fee };
});

/** Corrige un paquete registrado por error (anula su cargo). */
export const deleteCustodyPackage = safe(async function deleteCustodyPackage(packageId: string) {
  await requireStaff();
  const pkg = await prisma.custodyPackage.findUnique({ where: { id: packageId } });
  if (!pkg) throw new Error('Paquete no encontrado');
  if (pkg.status !== 'IN_CUSTODY') throw new Error('Un paquete entregado no se puede eliminar');
  await inTransaction(async (tx) => {
    await tx.custodyPackage.delete({ where: { id: packageId } });
    if (pkg.invoiceId) await cancelInvoice(tx, pkg.invoiceId);
  });
  revalidateCustody(pkg.clientId);
  return { success: true };
});
