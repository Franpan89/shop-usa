'use server';

import { safe } from '@/lib/action';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { audit, getSettings, getTenantId, inTransaction } from '@/lib/tenant';
import { createInvoice, reconcileClient, refreshOrder } from '@/lib/accounting';
import { receiveIntoConsolidation } from '@/lib/consolidation';
import { custodyFee } from '@/lib/domain/pricing';

function revalidateFlow(clientIds: string[] = []) {
  revalidatePath('/compras');
  revalidatePath('/recepcion');
  revalidatePath('/pedidos');
  revalidatePath('/consolidados');
  revalidatePath('/dashboard');
  revalidatePath('/portal', 'layout');
  for (const id of clientIds) revalidatePath(`/clientes/${id}`);
}

/** Compra por producto (2.11): no hace falta marcar todo el pedido a la vez. */
export const markProductsPurchased = safe(async function markProductsPurchased(productIds: string[]) {
  const user = await requireStaff();
  if (!productIds?.length) throw new Error('Selecciona al menos un producto');

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, status: true, orderId: true, clientId: true },
  });
  const blocked = products.filter((p) => p.status !== 'READY_TO_BUY');
  if (blocked.length > 0) {
    throw new Error(`No están listos para comprar (falta pago aprobado): ${blocked.map((p) => p.name).join(', ')}`);
  }

  const orderIds = Array.from(new Set(products.map((p) => p.orderId).filter((id): id is string => !!id)));
  await inTransaction(async (tx) => {
    await tx.product.updateMany({ where: { id: { in: productIds } }, data: { status: 'PURCHASED', purchasedAt: new Date() } });
    for (const id of orderIds) await refreshOrder(tx, id);
    await audit(tx, { userName: user.name, action: 'product.purchased', entity: 'Product', data: { count: productIds.length } });
  });

  revalidateFlow(products.map((p) => p.clientId));
  return { success: true, count: productIds.length };
});

export const undoProductPurchased = safe(async function undoProductPurchased(productId: string) {
  const user = await requireStaff();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Producto no encontrado');
  if (product.status !== 'PURCHASED') throw new Error('Solo se puede deshacer una compra que aún no fue recibida');

  await inTransaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { status: 'READY_TO_BUY', purchasedAt: null } });
    if (product.orderId) await refreshOrder(tx, product.orderId);
    await audit(tx, { userName: user.name, action: 'product.purchase.undo', entity: 'Product', entityId: productId });
  });
  revalidateFlow([product.clientId]);
  return { success: true };
});

export const setProductPhoto = safe(async function setProductPhoto(productId: string, imageUrl: string) {
  await requireStaff();
  if (!imageUrl?.trim()) throw new Error('Foto inválida');
  const product = await prisma.product.update({ where: { id: productId }, data: { imageUrl: imageUrl.trim() }, select: { clientId: true } });
  revalidateFlow([product.clientId]);
  return { success: true };
});

/**
 * Recepción de productos ya comprados (Personal Shopper / Carrito): solo se marcan RECIBIDOS,
 * sin volver a escribirlos. La foto es obligatoria; si el producto ya tenía una, se conserva.
 */
export const receiveProducts = safe(async function receiveProducts(productIds: string[]) {
  const user = await requireStaff();
  if (!productIds?.length) throw new Error('Selecciona al menos un producto');
  const tenantId = await getTenantId();

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, status: true, imageUrl: true, orderId: true, clientId: true },
  });
  const notPurchased = products.filter((p) => p.status !== 'PURCHASED');
  if (notPurchased.length > 0) throw new Error(`Aún no figuran como comprados: ${notPurchased.map((p) => p.name).join(', ')}`);
  const noPhoto = products.filter((p) => !p.imageUrl);
  if (noPhoto.length > 0) throw new Error(`Agrega la foto antes de recibir: ${noPhoto.map((p) => p.name).join(', ')}`);

  const orderIds = Array.from(new Set(products.map((p) => p.orderId).filter((id): id is string => !!id)));
  await inTransaction(async (tx) => {
    await receiveIntoConsolidation(tx, tenantId, productIds);
    for (const id of orderIds) await refreshOrder(tx, id);
    await audit(tx, { userName: user.name, action: 'product.received', entity: 'Product', data: { count: productIds.length } });
  });

  revalidateFlow(products.map((p) => p.clientId));
  return { success: true, count: productIds.length };
});

export interface CasilleroItemInput {
  name: string;
  quantity: number;
  imageUrl: string;
}

/**
 * Recepción de Casillero (Etapa 4): el producto nace en el sistema al recibirlo.
 * Descripción, cantidad y foto son obligatorios; origen CASILLERO y fecha automáticos.
 * Entra directo al consolidado abierto del cliente.
 */
export const createCasilleroItems = safe(async function createCasilleroItems(clientId: string, items: CasilleroItemInput[]) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  if (!items?.length) throw new Error('Agrega al menos un producto');

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error('Selecciona un cliente');

  const cleaned = items.map((i, idx) => {
    const name = i.name?.trim();
    const quantity = Math.floor(Number(i.quantity));
    if (!name) throw new Error(`La descripción del producto #${idx + 1} es obligatoria`);
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`La cantidad de "${name}" es obligatoria`);
    if (!i.imageUrl?.trim()) throw new Error(`La foto de "${name}" es obligatoria`);
    return { name, quantity, imageUrl: i.imageUrl.trim() };
  });

  await inTransaction(async (tx) => {
    const created = await Promise.all(
      cleaned.map((i) =>
        tx.product.create({
          data: { tenantId, clientId, origin: 'CASILLERO', status: 'PURCHASED', name: i.name, quantity: i.quantity, imageUrl: i.imageUrl, purchasedAt: new Date() },
          select: { id: true },
        }),
      ),
    );
    await receiveIntoConsolidation(tx, tenantId, created.map((c) => c.id));
    await audit(tx, { userName: user.name, action: 'casillero.receive', entity: 'Client', entityId: clientId, data: { count: cleaned.length } });
  });

  revalidateFlow([clientId]);
  return { success: true, count: cleaned.length };
});

/** Corrige un producto de Casillero recién recibido mientras siga en un consolidado abierto y sin PKG. */
export const deleteCasilleroItem = safe(async function deleteCasilleroItem(productId: string) {
  await requireStaff();
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { consolidation: { select: { status: true } } } });
  if (!product) throw new Error('Producto no encontrado');
  if (product.origin !== 'CASILLERO') throw new Error('Solo se pueden eliminar productos de Casillero');
  if (product.pkgId || product.consolidation?.status === 'CLOSED') throw new Error('Ya está en un despacho; no se puede eliminar');
  await prisma.product.delete({ where: { id: productId } });
  revalidateFlow([product.clientId]);
  return { success: true };
});

export const updateCasilleroItem = safe(async function updateCasilleroItem(productId: string, input: { name: string; quantity: number; imageUrl?: string }) {
  await requireStaff();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Producto no encontrado');
  if (!input.name?.trim() || !(input.quantity >= 1)) throw new Error('Descripción y cantidad son obligatorias');
  await prisma.product.update({
    where: { id: productId },
    data: { name: input.name.trim(), quantity: Math.floor(input.quantity), ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}) },
  });
  revalidateFlow([product.clientId]);
  return { success: true };
});

/**
 * Paquete clasificado como CUSTODIO (Etapa 9): se cierra sin registrar contenido,
 * solo tamaño y tienda/remitente, y genera su cargo en la cuenta del cliente.
 */
export const registerCustodyPackage = safe(async function registerCustodyPackage(input: {
  clientId: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  storeNote?: string;
}) {
  const user = await requireStaff();
  const settings = await getSettings();
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true, tenantId: true, custodyActive: true, name: true } });
  if (!client) throw new Error('Selecciona un cliente');
  if (!client.custodyActive) throw new Error(`${client.name} no tiene el servicio de Custodio activo`);

  const fee = custodyFee(input.size, {
    small: settings.custodySmallFee,
    medium: settings.custodyMediumFee,
    large: settings.custodyLargeFee,
  });
  const sizeLabel = { SMALL: 'Small', MEDIUM: 'Medium', LARGE: 'Large' }[input.size];

  await inTransaction(async (tx) => {
    const invoice = await createInvoice(tx, {
      tenantId: client.tenantId,
      clientId: client.id,
      type: 'CUSTODY',
      description: `Custodio de paquetería — ${sizeLabel}${input.storeNote ? ` (${input.storeNote.trim()})` : ''}`,
      lines: [{ kind: 'CUSTODY', description: `Custodio ${sizeLabel}`, amount: fee }],
    });
    await tx.custodyPackage.create({
      data: {
        tenantId: client.tenantId,
        clientId: client.id,
        size: input.size,
        fee,
        storeNote: input.storeNote?.trim() || null,
        invoiceId: invoice.id,
      },
    });
    await reconcileClient(tx, client.id);
    await audit(tx, { userName: user.name, action: 'custody.receive', entity: 'Client', entityId: client.id, data: { size: input.size, fee } });
  });

  revalidatePath('/custodio');
  revalidatePath('/recepcion');
  revalidatePath(`/clientes/${client.id}`);
  return { success: true, fee };
});

/** Marca o limpia un faltante/novedad detectado (desconsolidación o recepción). */
export const setProductIssue = safe(async function setProductIssue(productId: string, note: string | null) {
  await requireStaff();
  const product = await prisma.product.update({
    where: { id: productId },
    data: { issueNote: note?.trim() || null },
    select: { clientId: true },
  });
  revalidatePath('/desconsolidacion');
  revalidatePath(`/clientes/${product.clientId}`);
  return { success: true };
});

