'use server';

import { revalidatePath } from 'next/cache';
import type { GuideStatus, IdKind } from '@prisma/client';
import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { audit, getTenantId, inTransaction, type Db } from '@/lib/tenant';
import { ensurePkgGuide, nextIflNumber, nextRefNumber, seedRefCounter } from '@/lib/guides';
import {
  MANUAL_GUIDE_STATUSES,
  PKG_PREFIX,
  guideCode,
  guideRef,
  normalizeGuideFields,
  normalizePrefix,
  optional,
  optionalRaw,
  refNumberOf,
  upper,
  type GuideInput,
} from '@/lib/domain/guides';
import { isValidEmail } from '@/lib/domain/access';

function revalidateGuides(extra: string[] = []) {
  for (const p of ['/guias', '/guias/nueva', '/guias/remitentes', '/cajas', ...extra]) revalidatePath(p);
}

const ID_KINDS: IdKind[] = ['CEDULA', 'PASSPORT', 'RUC'];
const idKindOf = (v: unknown): IdKind => (ID_KINDS.includes(v as IdKind) ? (v as IdKind) : 'CEDULA');

// ── Remitentes ──────────────────────────────────────────────────────────────

export interface ShipperInput {
  name: string;
  idKind?: string;
  idNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
}

function shipperData(input: ShipperInput) {
  const name = upper(input.name);
  if (!name) throw new Error('Escribe el nombre completo del remitente');
  if (name.length > 120) throw new Error('El nombre es demasiado largo');
  const email = optionalRaw(input.email)?.toLowerCase() ?? null;
  if (email && !isValidEmail(email)) throw new Error('El correo no tiene un formato válido');
  return {
    name,
    idKind: idKindOf(input.idKind),
    idNumber: optional(input.idNumber),
    address: optional(input.address),
    city: optional(input.city),
    state: optional(input.state),
    phone: optionalRaw(input.phone),
    email,
  };
}

export const createShipper = safe(async function createShipper(input: ShipperInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const data = shipperData(input);
  const shipper = await prisma.shipper.create({ data: { tenantId, ...data } });
  await audit(prisma, { userName: user.name, action: 'shipper.create', entity: 'Shipper', entityId: shipper.id });
  revalidateGuides();
  return { shipperId: shipper.id, name: shipper.name, idNumber: shipper.idNumber, city: shipper.city };
});

export const updateShipper = safe(async function updateShipper(id: string, input: ShipperInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const current = await prisma.shipper.findFirst({ where: { id, tenantId } });
  if (!current) throw new Error('Remitente no encontrado');
  await prisma.shipper.update({ where: { id }, data: shipperData(input) });
  await audit(prisma, { userName: user.name, action: 'shipper.update', entity: 'Shipper', entityId: id });
  revalidateGuides([`/guias/remitentes/${id}`]);
  return { success: true };
});

export const setShipperActive = safe(async function setShipperActive(id: string, active: boolean) {
  await requireStaff();
  const tenantId = await getTenantId();
  const { count } = await prisma.shipper.updateMany({ where: { id, tenantId }, data: { active } });
  if (count === 0) throw new Error('Remitente no encontrado');
  revalidateGuides([`/guias/remitentes/${id}`]);
  return { success: true };
});

/** Solo se elimina un remitente que nunca tuvo guías; sus destinatarios se van con él. Si tuvo guías, se desactiva. */
export const deleteShipper = safe(async function deleteShipper(id: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const shipper = await prisma.shipper.findFirst({ where: { id, tenantId }, include: { _count: { select: { guides: true } } } });
  if (!shipper) throw new Error('Remitente no encontrado');
  if (shipper._count.guides > 0) throw new Error('Este remitente ya tiene guías: no se puede eliminar. Desactívalo para que no aparezca al crear guías.');
  await inTransaction(async (tx) => {
    await tx.consignee.deleteMany({ where: { shipperId: id } });
    await tx.shipper.delete({ where: { id } });
    await audit(tx, { userName: user.name, action: 'shipper.delete', entity: 'Shipper', entityId: id, data: { name: shipper.name } });
  });
  revalidateGuides();
  return { success: true };
});

// ── Destinatarios ───────────────────────────────────────────────────────────

export interface ConsigneeInput {
  name: string;
  idKind?: string;
  idNumber?: string;
  country?: string;
  province?: string;
  city?: string;
  declaredAddress?: string;
  deliveryAddress?: string;
  reference?: string;
  phone?: string;
  relationship?: string;
}

function consigneeData(input: ConsigneeInput) {
  const name = upper(input.name);
  if (!name) throw new Error('Escribe el nombre completo del destinatario');
  if (name.length > 120) throw new Error('El nombre es demasiado largo');
  return {
    name,
    idKind: idKindOf(input.idKind),
    idNumber: optional(input.idNumber),
    country: upper(input.country) || 'ECUADOR',
    province: optional(input.province),
    city: optional(input.city),
    declaredAddress: optional(input.declaredAddress),
    deliveryAddress: optional(input.deliveryAddress),
    reference: optional(input.reference),
    phone: optionalRaw(input.phone),
    relationship: optional(input.relationship),
  };
}

export const createConsignee = safe(async function createConsignee(shipperId: string, input: ConsigneeInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const shipper = await prisma.shipper.findFirst({ where: { id: shipperId, tenantId } });
  if (!shipper) throw new Error('Remitente no encontrado');
  const consignee = await prisma.consignee.create({ data: { tenantId, shipperId, ...consigneeData(input) } });
  await audit(prisma, { userName: user.name, action: 'consignee.create', entity: 'Consignee', entityId: consignee.id });
  revalidateGuides([`/guias/remitentes/${shipperId}`]);
  return {
    consigneeId: consignee.id,
    name: consignee.name,
    idNumber: consignee.idNumber,
    city: consignee.city,
    country: consignee.country,
    deliveryAddress: consignee.deliveryAddress,
  };
});

export const updateConsignee = safe(async function updateConsignee(id: string, input: ConsigneeInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const current = await prisma.consignee.findFirst({ where: { id, tenantId } });
  if (!current) throw new Error('Destinatario no encontrado');
  await prisma.consignee.update({ where: { id }, data: consigneeData(input) });
  await audit(prisma, { userName: user.name, action: 'consignee.update', entity: 'Consignee', entityId: id });
  revalidateGuides([`/guias/remitentes/${current.shipperId}`]);
  return { success: true };
});

export const setConsigneeActive = safe(async function setConsigneeActive(id: string, active: boolean) {
  await requireStaff();
  const tenantId = await getTenantId();
  const current = await prisma.consignee.findFirst({ where: { id, tenantId } });
  if (!current) throw new Error('Destinatario no encontrado');
  await prisma.consignee.update({ where: { id }, data: { active } });
  revalidateGuides([`/guias/remitentes/${current.shipperId}`]);
  return { success: true };
});

export const deleteConsignee = safe(async function deleteConsignee(id: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const current = await prisma.consignee.findFirst({ where: { id, tenantId }, include: { _count: { select: { guides: true } } } });
  if (!current) throw new Error('Destinatario no encontrado');
  if (current._count.guides > 0) throw new Error('Este destinatario ya tiene guías: no se puede eliminar. Desactívalo para que no aparezca al crear guías.');
  await prisma.consignee.delete({ where: { id } });
  await audit(prisma, { userName: user.name, action: 'consignee.delete', entity: 'Consignee', entityId: id, data: { name: current.name } });
  revalidateGuides([`/guias/remitentes/${current.shipperId}`]);
  return { success: true };
});

// ── Identificadores adicionales a PKG ───────────────────────────────────────

export const createGuideIdentifier = safe(async function createGuideIdentifier(input: { prefix: string; description?: string; startAt?: number | string }) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const prefix = normalizePrefix(input.prefix);
  if (!prefix) throw new Error('El identificador lleva de 2 a 6 letras o números y empieza con una letra (ej. JM)');
  if (prefix === PKG_PREFIX) throw new Error('PKG ya existe: es el número de la caja y no se crea aparte');
  if (prefix.startsWith('IFL')) throw new Error('Ese identificador se confunde con la guía IFLWH: usa otro');
  const startAt = input.startAt === undefined || input.startAt === '' ? 1 : refNumberOf(input.startAt);
  if (!startAt) throw new Error('El primer número debe ser un entero de 1 a 99999');
  if (await prisma.guideIdentifier.findFirst({ where: { tenantId, prefix } })) throw new Error(`El identificador ${prefix} ya existe`);

  const identifier = await inTransaction(async (tx) => {
    const created = await tx.guideIdentifier.create({ data: { tenantId, prefix, description: optionalRaw(input.description) } });
    await seedRefCounter(tx, tenantId, prefix, startAt);
    await audit(tx, { userName: user.name, action: 'guideIdentifier.create', entity: 'GuideIdentifier', entityId: created.id, data: { prefix, startAt } });
    return created;
  });
  revalidateGuides();
  return { prefix: identifier.prefix, description: identifier.description, nextNumber: startAt };
});

export const setGuideIdentifierActive = safe(async function setGuideIdentifierActive(id: string, active: boolean) {
  await requireStaff();
  const tenantId = await getTenantId();
  const { count } = await prisma.guideIdentifier.updateMany({ where: { id, tenantId }, data: { active } });
  if (count === 0) throw new Error('Identificador no encontrado');
  revalidateGuides();
  return { success: true };
});

/** Solo se elimina un identificador que nunca se usó en una guía; si se usó, se desactiva. */
export const deleteGuideIdentifier = safe(async function deleteGuideIdentifier(id: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const identifier = await prisma.guideIdentifier.findFirst({ where: { id, tenantId } });
  if (!identifier) throw new Error('Identificador no encontrado');
  const used = await prisma.guide.count({ where: { tenantId, refPrefix: identifier.prefix } });
  if (used > 0) throw new Error(`${identifier.prefix} ya está en ${used} guía(s): no se puede eliminar. Desactívalo para que no aparezca al crear guías.`);
  await inTransaction(async (tx) => {
    await tx.guideIdentifier.delete({ where: { id } });
    await tx.counter.deleteMany({ where: { tenantId, key: `guideRef:${identifier.prefix}` } });
    await audit(tx, { userName: user.name, action: 'guideIdentifier.delete', entity: 'GuideIdentifier', entityId: id, data: { prefix: identifier.prefix } });
  });
  revalidateGuides();
  return { success: true };
});

// ── Guías ───────────────────────────────────────────────────────────────────

/**
 * Identificador que se imprime en la guía como tracking. PKG: el número lo escribe el personal
 * (es el de la caja). Otro identificador (JM): el número lo asigna el sistema, 001, 002…
 */
async function resolveRef(tx: Db, tenantId: string, input: GuideInput) {
  const prefix = normalizePrefix(input.refPrefix || PKG_PREFIX);
  if (!prefix) throw new Error('Elige el identificador de la guía (PKG u otro)');
  if (prefix === PKG_PREFIX) {
    const n = refNumberOf(input.refNumber);
    if (!n) throw new Error('Indica el número del PKG (de 1 a 99999)');
    return { refPrefix: prefix, refNumber: n, refCode: guideRef(prefix, n) };
  }
  const identifier = await tx.guideIdentifier.findFirst({ where: { tenantId, prefix } });
  if (!identifier) throw new Error(`El identificador ${prefix} no existe`);
  if (!identifier.active) throw new Error(`El identificador ${prefix} está desactivado`);
  const n = await nextRefNumber(tx, tenantId, prefix);
  return { refPrefix: prefix, refNumber: n, refCode: guideRef(prefix, n) };
}

/** Crea una guía: toma el siguiente número IFLWH (00100, 00101…) sin saltos ni repetidos y lleva su PKG o identificador. */
export const createGuide = safe(async function createGuide(input: GuideInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  if (!input.shipperId) throw new Error('Selecciona el remitente');
  if (!input.consigneeId) throw new Error('Selecciona el destinatario');
  const parsed = normalizeGuideFields(input);
  if (!parsed.ok) throw new Error(parsed.error);

  const guide = await inTransaction(async (tx) => {
    const [shipper, consignee] = await Promise.all([
      tx.shipper.findFirst({ where: { id: input.shipperId, tenantId } }),
      tx.consignee.findFirst({ where: { id: input.consigneeId, tenantId } }),
    ]);
    if (!shipper) throw new Error('Remitente no encontrado');
    if (!consignee) throw new Error('Destinatario no encontrado');
    if (!shipper.active) throw new Error('El remitente está desactivado');
    if (!consignee.active) throw new Error('El destinatario está desactivado');
    if (consignee.shipperId !== shipper.id) throw new Error('Ese destinatario pertenece a otro remitente');

    const ref = await resolveRef(tx, tenantId, input);
    const number = await nextIflNumber(tx, tenantId);
    const created = await tx.guide.create({
      data: {
        tenantId,
        series: 'IFL',
        number,
        code: guideCode(number),
        ...ref,
        status: input.retain ? 'RETAINED' : 'CREATED',
        shipperId: shipper.id,
        consigneeId: consignee.id,
        ...parsed.value,
        createdBy: user.name,
      },
    });
    await audit(tx, { userName: user.name, action: 'guide.create', entity: 'Guide', entityId: created.id, data: { code: created.code } });
    return created;
  });
  revalidateGuides();
  return { guideId: guide.id, code: guide.code, refCode: guide.refCode };
});

/** Edita los datos de la guía; remitente y destinatario no cambian (si se equivocó, se anula y se crea otra). */
export const updateGuide = safe(async function updateGuide(id: string, input: GuideInput) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const guide = await prisma.guide.findFirst({ where: { id, tenantId } });
  if (!guide) throw new Error('Guía no encontrada');
  if (guide.status === 'VOIDED') throw new Error('La guía está anulada y no se puede editar');

  if (guide.series === 'PKG') {
    // La caja no tiene remitente ni destinatario: solo peso, contenido y notas.
    const weight = input.weightLb === '' || input.weightLb == null ? null : Number(String(input.weightLb).replace(',', '.'));
    if (weight != null && (!Number.isFinite(weight) || weight <= 0 || weight > 9999)) throw new Error('El peso no es válido');
    await prisma.guide.update({
      where: { id },
      data: { weightLb: weight == null ? null : Math.round(weight * 100) / 100, contents: optional(input.contents), notes: optionalRaw(input.notes) },
    });
  } else {
    const parsed = normalizeGuideFields(input);
    if (!parsed.ok) throw new Error(parsed.error);
    // El PKG se puede corregir (error de digitación); el número de otros identificadores es consecutivo y no cambia.
    let ref: { refPrefix: string; refNumber: number; refCode: string } | undefined;
    if (input.refPrefix !== undefined && (!guide.refPrefix || guide.refPrefix === PKG_PREFIX) && normalizePrefix(input.refPrefix) === PKG_PREFIX) {
      const n = refNumberOf(input.refNumber);
      if (!n) throw new Error('Indica el número del PKG (de 1 a 99999)');
      ref = { refPrefix: PKG_PREFIX, refNumber: n, refCode: guideRef(PKG_PREFIX, n) };
    }
    await prisma.guide.update({ where: { id }, data: { ...parsed.value, ...ref } });
  }
  await audit(prisma, { userName: user.name, action: 'guide.update', entity: 'Guide', entityId: id, data: { code: guide.code } });
  revalidateGuides();
  return { success: true };
});

export const setGuideStatus = safe(async function setGuideStatus(id: string, status: GuideStatus) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  if (!MANUAL_GUIDE_STATUSES.includes(status)) throw new Error('Estado no permitido');
  const guide = await prisma.guide.findFirst({ where: { id, tenantId } });
  if (!guide) throw new Error('Guía no encontrada');
  if (guide.series === 'PKG') throw new Error('La guía de un PKG sigue el estado de la caja');
  if (guide.status === 'VOIDED') throw new Error('La guía está anulada');
  await prisma.guide.update({ where: { id }, data: { status } });
  await audit(prisma, { userName: user.name, action: 'guide.status', entity: 'Guide', entityId: id, data: { code: guide.code, status } });
  revalidateGuides();
  return { success: true };
});

/** Anula la guía: queda en el historial y su número no se reutiliza. */
export const voidGuide = safe(async function voidGuide(id: string, reason: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const guide = await prisma.guide.findFirst({ where: { id, tenantId } });
  if (!guide) throw new Error('Guía no encontrada');
  if (guide.series === 'PKG') throw new Error('La guía de un PKG se elimina junto con el PKG');
  if (guide.status === 'VOIDED') throw new Error('La guía ya está anulada');
  if (guide.status === 'DELIVERED') throw new Error('No se puede anular una guía entregada');
  await prisma.guide.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: optionalRaw(reason) } });
  await audit(prisma, { userName: user.name, action: 'guide.void', entity: 'Guide', entityId: id, data: { code: guide.code, reason: reason || null } });
  revalidateGuides();
  return { success: true };
});

/** Lleva la cuenta de impresiones (Reimprimir). */
export const registerGuidePrints = safe(async function registerGuidePrints(ids: string[]) {
  await requireStaff();
  const tenantId = await getTenantId();
  if (!ids?.length) return;
  await prisma.guide.updateMany({
    where: { id: { in: ids.slice(0, 500) }, tenantId },
    data: { printCount: { increment: 1 }, lastPrintedAt: new Date() },
  });
  revalidatePath('/guias');
});

/** Genera la guía de un PKG que todavía no la tiene. */
export const generatePkgGuide = safe(async function generatePkgGuide(pkgId: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const pkg = await prisma.pkg.findFirst({ where: { id: pkgId, tenantId } });
  if (!pkg) throw new Error('PKG no encontrado');
  const { guide, created } = await ensurePkgGuide(prisma, pkg, user.name);
  if (created) await audit(prisma, { userName: user.name, action: 'guide.create', entity: 'Guide', entityId: guide.id, data: { code: guide.code } });
  revalidateGuides([`/cajas/${pkgId}`]);
  return { guideId: guide.id, code: guide.code };
});
