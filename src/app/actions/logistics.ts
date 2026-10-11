'use server';

import { safe } from '@/lib/action';
import type { PkgStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { audit, getTenantId, inTransaction } from '@/lib/tenant';
import { getCountryRuleMap, invoiceBalanceOf, suggestNextPkgNumber } from '@/lib/logistics';
import { isDeliveryAuthorized, isDispatchAuthorized, PKG_TO_PRODUCT_STATUS } from '@/lib/domain/flow';
import { sendReadyForPickupEmail, sendShippedEmail } from '@/lib/email';

function revalidateLogistics(clientIds: string[] = []) {
  for (const p of ['/cajas', '/despachos', '/desconsolidacion', '/entregas', '/consolidados', '/dashboard']) revalidatePath(p);
  revalidatePath('/portal', 'layout');
  for (const id of clientIds) revalidatePath(`/clientes/${id}`);
}

// ── PKG (Etapa 8) ───────────────────────────────────────────────────────────

export const createPkg = safe(async function createPkg(input: { country: string; number?: number }) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  if (!input.country?.trim()) throw new Error('Selecciona el país de destino');

  const pkg = await inTransaction(async (tx) => {
    const number = input.number && input.number > 0 ? Math.floor(input.number) : await suggestNextPkgNumber(tx);
    const taken = await tx.pkg.findUnique({ where: { tenantId_number: { tenantId, number } } });
    if (taken) throw new Error(`Ya existe el PKG${number}`);
    const created = await tx.pkg.create({ data: { tenantId, number, country: input.country.trim() } });
    await audit(tx, { userName: user.name, action: 'pkg.create', entity: 'Pkg', entityId: created.id, data: { number } });
    return created;
  });
  revalidateLogistics();
  return { success: true, pkgId: pkg.id };
});

export const updatePkgInfo = safe(async function updatePkgInfo(
  pkgId: string,
  input: { number?: number; trackingNumber?: string; carrier?: string; notes?: string },
) {
  await requireStaff();
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId } });
  if (!pkg) throw new Error('PKG no encontrado');

  let number = pkg.number;
  if (input.number && input.number !== pkg.number) {
    if (pkg.status !== 'IN_PREPARATION') throw new Error('Solo se puede cambiar el número mientras el PKG está en preparación');
    const taken = await prisma.pkg.findUnique({ where: { tenantId_number: { tenantId: pkg.tenantId, number: input.number } } });
    if (taken) throw new Error(`Ya existe el PKG${input.number}`);
    number = Math.floor(input.number);
  }

  await prisma.pkg.update({
    where: { id: pkgId },
    data: {
      number,
      trackingNumber: input.trackingNumber?.trim() || null,
      carrier: input.carrier?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  revalidateLogistics();
  revalidatePath(`/cajas/${pkgId}`);
  return { success: true };
});

/**
 * Asigna productos (de cualquier cliente) a un PKG abierto. Solo entran productos con su
 * consolidado cerrado, sin PKG y autorizados para despacho según las reglas del país.
 */
export const assignProductsToPkg = safe(async function assignProductsToPkg(pkgId: string, productIds: string[]) {
  const user = await requireStaff();
  if (!productIds?.length) throw new Error('Selecciona al menos un producto');
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId } });
  if (!pkg) throw new Error('PKG no encontrado');
  if (pkg.status !== 'IN_PREPARATION') throw new Error('El PKG está cerrado; reábrelo para modificarlo');

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      client: { select: { name: true, country: true } },
      consolidation: { select: { status: true, invoice: { select: { total: true, paidAmount: true, status: true } } } },
    },
  });
  const { ruleFor } = await getCountryRuleMap();

  for (const p of products) {
    if (p.pkgId) throw new Error(`"${p.name}" ya está en un PKG`);
    if (p.status !== 'RECEIVED') throw new Error(`"${p.name}" no está recibido en bodega`);
    if (p.consolidation?.status !== 'CLOSED') throw new Error(`El consolidado de ${p.client.name} aún no está cerrado`);
    if (p.client.country !== pkg.country) throw new Error(`"${p.name}" es de ${p.client.country}; este PKG va a ${pkg.country}`);
    const balance = invoiceBalanceOf(p.consolidation.invoice);
    if (!isDispatchAuthorized(balance, ruleFor(p.client.country))) {
      throw new Error(`${p.client.name} tiene saldo pendiente: no está autorizado para despacho a ${p.client.country}`);
    }
  }

  await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { pkgId } });
  await audit(prisma, { userName: user.name, action: 'pkg.assign', entity: 'Pkg', entityId: pkgId, data: { count: productIds.length } });
  revalidateLogistics();
  revalidatePath(`/cajas/${pkgId}`);
  return { success: true };
});

export const removeProductFromPkg = safe(async function removeProductFromPkg(productId: string) {
  await requireStaff();
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { pkg: true } });
  if (!product?.pkg) throw new Error('El producto no está en un PKG');
  if (product.pkg.status !== 'IN_PREPARATION') throw new Error('El PKG está cerrado; reábrelo para modificarlo');
  await prisma.product.update({ where: { id: productId }, data: { pkgId: null } });
  revalidateLogistics();
  revalidatePath(`/cajas/${product.pkg.id}`);
  return { success: true };
});

export const moveProductToPkg = safe(async function moveProductToPkg(productId: string, toPkgId: string) {
  await requireStaff();
  const [product, target] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, include: { pkg: true, client: { select: { country: true } } } }),
    prisma.pkg.findUnique({ where: { id: toPkgId } }),
  ]);
  if (!product?.pkg || !target) throw new Error('Producto o PKG no encontrado');
  if (product.pkg.status !== 'IN_PREPARATION' || target.status !== 'IN_PREPARATION') throw new Error('Ambos PKG deben estar en preparación');
  if (target.country !== product.client.country) throw new Error(`El PKG destino va a ${target.country}`);
  await prisma.product.update({ where: { id: productId }, data: { pkgId: toPkgId } });
  revalidateLogistics();
  return { success: true };
});

export const closePkg = safe(async function closePkg(pkgId: string) {
  const user = await requireStaff();
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId }, include: { _count: { select: { products: true } } } });
  if (!pkg) throw new Error('PKG no encontrado');
  if (pkg.status !== 'IN_PREPARATION') throw new Error('El PKG ya está cerrado');
  if (pkg._count.products === 0) throw new Error('El PKG no tiene productos');
  await prisma.pkg.update({ where: { id: pkgId }, data: { status: 'CLOSED', closedAt: new Date() } });
  await audit(prisma, { userName: user.name, action: 'pkg.close', entity: 'Pkg', entityId: pkgId });
  revalidateLogistics();
  revalidatePath(`/cajas/${pkgId}`);
  return { success: true };
});

/** Corrección administrativa antes del despacho (8.8). */
export const reopenPkg = safe(async function reopenPkg(pkgId: string) {
  const user = await requireStaff();
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId }, include: { dispatch: { select: { status: true } } } });
  if (!pkg) throw new Error('PKG no encontrado');
  if (pkg.status !== 'CLOSED') throw new Error('Solo se puede reabrir un PKG cerrado que aún no salió');
  if (pkg.dispatch?.status === 'CONFIRMED') throw new Error('El PKG ya salió en un despacho confirmado');
  await prisma.pkg.update({ where: { id: pkgId }, data: { status: 'IN_PREPARATION', closedAt: null, dispatchId: null } });
  await audit(prisma, { userName: user.name, action: 'pkg.reopen', entity: 'Pkg', entityId: pkgId });
  revalidateLogistics();
  revalidatePath(`/cajas/${pkgId}`);
  return { success: true };
});

export const deletePkg = safe(async function deletePkg(pkgId: string) {
  await requireStaff();
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId }, include: { _count: { select: { products: true } } } });
  if (!pkg) throw new Error('PKG no encontrado');
  if (pkg.status !== 'IN_PREPARATION' || pkg._count.products > 0) throw new Error('Solo se puede eliminar un PKG vacío y en preparación');
  await prisma.pkg.delete({ where: { id: pkgId } });
  revalidateLogistics();
  return { success: true };
});

/**
 * Actualización manual del estado del PKG (6.5): UNA actualización que se refleja
 * automáticamente en todos los productos que contiene.
 */
export const setPkgStatus = safe(async function setPkgStatus(pkgId: string, status: PkgStatus) {
  const user = await requireStaff();
  const pkg = await prisma.pkg.findUnique({
    where: { id: pkgId },
    include: { dispatch: { select: { status: true } }, products: { include: { client: { select: { id: true, name: true, country: true } }, consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true } } } } } } },
  });
  if (!pkg) throw new Error('PKG no encontrado');
  if (!['IN_TRANSIT', 'AT_DESTINATION', 'READY_FOR_PICKUP', 'DELIVERED'].includes(status)) throw new Error('Estado no permitido');
  if (pkg.dispatch?.status !== 'CONFIRMED') throw new Error('El PKG todavía no salió en un despacho confirmado');

  if (status === 'DELIVERED') {
    const { ruleFor } = await getCountryRuleMap();
    const blocked = pkg.products.filter((p) => p.status !== 'DELIVERED' && p.status !== 'CANCELLED' && !isDeliveryAuthorized(invoiceBalanceOf(p.consolidation?.invoice), ruleFor(p.client.country)));
    if (blocked.length > 0) {
      throw new Error(`No entregar: saldo pendiente de ${Array.from(new Set(blocked.map((b) => b.client.name))).join(', ')}`);
    }
  }

  const productStatus = PKG_TO_PRODUCT_STATUS[status];
  await inTransaction(async (tx) => {
    await tx.pkg.update({ where: { id: pkgId }, data: { status } });
    if (productStatus) {
      await tx.product.updateMany({
        where: { pkgId, status: { not: 'CANCELLED' } },
        data: { status: productStatus, ...(productStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
      });
    }
    await audit(tx, { userName: user.name, action: 'pkg.status', entity: 'Pkg', entityId: pkgId, data: { status } });
  });
  revalidateLogistics(pkg.products.map((p) => p.clientId));
  revalidatePath(`/cajas/${pkgId}`);
  return { success: true };
});

// ── Despachos ───────────────────────────────────────────────────────────────

export const createDispatch = safe(async function createDispatch(input: { country: string; date: string; notes?: string }) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  if (!input.country?.trim() || !input.date) throw new Error('Indica el país y la fecha del despacho');

  const dispatch = await inTransaction(async (tx) => {
    const last = await tx.dispatch.findFirst({ where: { tenantId }, orderBy: { number: 'desc' }, select: { number: true } });
    const created = await tx.dispatch.create({
      data: { tenantId, number: (last?.number ?? 0) + 1, country: input.country.trim(), date: new Date(input.date), notes: input.notes?.trim() || null },
    });
    await audit(tx, { userName: user.name, action: 'dispatch.create', entity: 'Dispatch', entityId: created.id });
    return created;
  });
  revalidateLogistics();
  return { success: true, dispatchId: dispatch.id };
});

/** El administrador decide qué PKG van en cada despacho; nada se asigna solo al "próximo lunes". */
export const addPkgsToDispatch = safe(async function addPkgsToDispatch(dispatchId: string, pkgIds: string[]) {
  await requireStaff();
  const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
  if (!dispatch) throw new Error('Despacho no encontrado');
  if (dispatch.status !== 'DRAFT') throw new Error('El despacho ya fue confirmado');
  const pkgs = await prisma.pkg.findMany({ where: { id: { in: pkgIds } } });
  for (const p of pkgs) {
    if (p.status !== 'CLOSED') throw new Error(`PKG${p.number} debe estar cerrado`);
    if (p.dispatchId) throw new Error(`PKG${p.number} ya está en otro despacho`);
    if (p.country !== dispatch.country) throw new Error(`PKG${p.number} va a ${p.country}, no a ${dispatch.country}`);
  }
  await prisma.pkg.updateMany({ where: { id: { in: pkgIds } }, data: { dispatchId } });
  revalidateLogistics();
  revalidatePath(`/despachos/${dispatchId}`);
  return { success: true };
});

export const removePkgFromDispatch = safe(async function removePkgFromDispatch(pkgId: string) {
  await requireStaff();
  const pkg = await prisma.pkg.findUnique({ where: { id: pkgId }, include: { dispatch: true } });
  if (!pkg?.dispatch) throw new Error('El PKG no está en un despacho');
  if (pkg.dispatch.status !== 'DRAFT') throw new Error('El despacho ya fue confirmado');
  await prisma.pkg.update({ where: { id: pkgId }, data: { dispatchId: null } });
  revalidateLogistics();
  revalidatePath(`/despachos/${pkg.dispatch.id}`);
  return { success: true };
});

/**
 * Confirmar que el despacho salió: SOLO ahora los productos pasan a EN TRÁNSITO (8.16).
 * Asignar un producto a un PKG no significa que ya viajó.
 */
export const confirmDispatch = safe(async function confirmDispatch(dispatchId: string) {
  const user = await requireStaff();
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: { pkgs: { include: { products: { where: { status: { not: 'CANCELLED' } }, include: { client: { select: { id: true, name: true, email: true } } } } } } },
  });
  if (!dispatch) throw new Error('Despacho no encontrado');
  if (dispatch.status === 'CONFIRMED') throw new Error('El despacho ya fue confirmado');
  if (dispatch.pkgs.length === 0) throw new Error('Agrega al menos un PKG al despacho');

  const pkgIds = dispatch.pkgs.map((p) => p.id);
  await inTransaction(async (tx) => {
    await tx.dispatch.update({ where: { id: dispatchId }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    await tx.pkg.updateMany({ where: { id: { in: pkgIds } }, data: { status: 'IN_TRANSIT' } });
    await tx.product.updateMany({ where: { pkgId: { in: pkgIds }, status: 'RECEIVED' }, data: { status: 'IN_TRANSIT' } });
    await audit(tx, { userName: user.name, action: 'dispatch.confirm', entity: 'Dispatch', entityId: dispatchId, data: { pkgs: pkgIds.length } });
  });

  // Aviso por cliente con sus productos (sin mencionar PKG ni guías: el cliente no lo necesita).
  const byClient = new Map<string, { name: string; email: string | null; items: string[] }>();
  for (const pkg of dispatch.pkgs) {
    for (const p of pkg.products) {
      const e = byClient.get(p.client.id) ?? { name: p.client.name, email: p.client.email, items: [] };
      e.items.push(p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name);
      byClient.set(p.client.id, e);
    }
  }
  for (const c of byClient.values()) {
    if (c.email) await sendShippedEmail({ to: c.email, clientName: c.name, products: c.items });
  }

  revalidateLogistics(Array.from(byClient.keys()));
  revalidatePath(`/despachos/${dispatchId}`);
  return { success: true };
});

export const deleteDispatch = safe(async function deleteDispatch(dispatchId: string) {
  await requireStaff();
  const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
  if (!dispatch) throw new Error('Despacho no encontrado');
  if (dispatch.status !== 'DRAFT') throw new Error('Un despacho confirmado no se puede eliminar');
  await inTransaction(async (tx) => {
    await tx.pkg.updateMany({ where: { dispatchId }, data: { dispatchId: null } });
    await tx.dispatch.delete({ where: { id: dispatchId } });
  });
  revalidateLogistics();
  return { success: true };
});

// ── Desconsolidación (Ecuador) ──────────────────────────────────────────────

/** Marca los PKG como recibidos físicamente en destino. Los productos siguen en tránsito hasta confirmarlos uno a uno. */
export const receivePkgsAtDestination = safe(async function receivePkgsAtDestination(pkgIds: string[]) {
  const user = await requireStaff();
  if (!pkgIds?.length) throw new Error('Selecciona los PKG recibidos');
  const pkgs = await prisma.pkg.findMany({ where: { id: { in: pkgIds } } });
  const wrong = pkgs.filter((p) => p.status !== 'IN_TRANSIT' && p.status !== 'AT_DESTINATION');
  if (wrong.length > 0) throw new Error(`Aún no están en tránsito: ${wrong.map((p) => `PKG${p.number}`).join(', ')}`);
  await prisma.pkg.updateMany({ where: { id: { in: pkgIds }, status: 'IN_TRANSIT' }, data: { status: 'AT_DESTINATION' } });
  await audit(prisma, { userName: user.name, action: 'pkg.received', entity: 'Pkg', data: { pkgIds } });
  revalidateLogistics();
  return { success: true };
});

/**
 * Confirma productos encontrados durante la desconsolidación: pasan a LISTO PARA RETIRAR.
 * Avisa al cliente y, si todo el PKG ya fue confirmado, cierra el PKG como listo.
 */
export const confirmProductsArrived = safe(async function confirmProductsArrived(productIds: string[]) {
  const user = await requireStaff();
  if (!productIds?.length) throw new Error('Selecciona los productos encontrados');

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      client: { select: { id: true, name: true, email: true } },
      consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true } } } },
    },
  });
  const wrong = products.filter((p) => p.status !== 'IN_TRANSIT');
  if (wrong.length > 0) throw new Error(`Ya fueron confirmados o no están en tránsito: ${wrong.map((p) => p.name).join(', ')}`);

  const pkgIds = Array.from(new Set(products.map((p) => p.pkgId).filter((id): id is string => !!id)));
  await inTransaction(async (tx) => {
    await tx.product.updateMany({
      where: { id: { in: productIds } },
      data: { status: 'READY_FOR_PICKUP', destinationReceivedAt: new Date(), issueNote: null },
    });
    for (const pkgId of pkgIds) {
      const remaining = await tx.product.count({ where: { pkgId, status: 'IN_TRANSIT' } });
      await tx.pkg.update({ where: { id: pkgId }, data: { status: remaining === 0 ? 'READY_FOR_PICKUP' : 'AT_DESTINATION' } });
    }
    await audit(tx, { userName: user.name, action: 'deconsolidation.confirm', entity: 'Product', data: { count: productIds.length } });
  });

  const byClient = new Map<string, { name: string; email: string | null; items: string[]; balance: number }>();
  for (const p of products) {
    const e = byClient.get(p.client.id) ?? { name: p.client.name, email: p.client.email, items: [], balance: 0 };
    e.items.push(p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name);
    e.balance = Math.max(e.balance, invoiceBalanceOf(p.consolidation?.invoice));
    byClient.set(p.client.id, e);
  }
  for (const c of byClient.values()) {
    if (c.email) await sendReadyForPickupEmail({ to: c.email, clientName: c.name, products: c.items, balance: c.balance });
  }

  revalidateLogistics(Array.from(byClient.keys()));
  return { success: true, count: productIds.length };
});

// ── Entregas ────────────────────────────────────────────────────────────────

/** Entrega al cliente. Se bloquea si la factura del despacho mantiene saldo y el país lo exige (7.11). */
export const markProductsDelivered = safe(async function markProductsDelivered(productIds: string[]) {
  const user = await requireStaff();
  if (!productIds?.length) throw new Error('Selecciona los productos a entregar');

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      client: { select: { id: true, name: true, country: true } },
      consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true } } } },
    },
  });
  const { ruleFor } = await getCountryRuleMap();
  for (const p of products) {
    if (p.status !== 'READY_FOR_PICKUP') throw new Error(`"${p.name}" todavía no está listo para retirar`);
    if (!isDeliveryAuthorized(invoiceBalanceOf(p.consolidation?.invoice), ruleFor(p.client.country))) {
      throw new Error(`NO ENTREGAR a ${p.client.name}: tiene saldo pendiente en su factura de despacho`);
    }
  }

  const pkgIds = Array.from(new Set(products.map((p) => p.pkgId).filter((id): id is string => !!id)));
  await inTransaction(async (tx) => {
    await tx.product.updateMany({ where: { id: { in: productIds } }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    for (const pkgId of pkgIds) {
      const open = await tx.product.count({ where: { pkgId, status: { notIn: ['DELIVERED', 'CANCELLED'] } } });
      if (open === 0) await tx.pkg.update({ where: { id: pkgId }, data: { status: 'DELIVERED' } });
    }
    await audit(tx, { userName: user.name, action: 'product.delivered', entity: 'Product', data: { count: productIds.length } });
  });

  revalidateLogistics(products.map((p) => p.clientId));
  return { success: true, count: productIds.length };
});
