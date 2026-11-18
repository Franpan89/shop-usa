import type { GuideSeries, GuideStatus, IdKind } from '@prisma/client';
import type { StatusMeta } from './flow';

/**
 * Reglas puras de las guías (etiquetas térmicas): numeración, textos y validación.
 * Sin base de datos ni Next: se prueban con `npm test`.
 */

/** La serie IFL arranca en IFLWH00100. */
export const IFL_GUIDE_START = 100;

/** IFLWH00100 · PKG500 (la guía de un PKG lleva el mismo número que la caja). */
export function guideCode(series: GuideSeries, number: number): string {
  return series === 'IFL' ? `IFLWH${String(number).padStart(5, '0')}` : `PKG${number}`;
}

export const GUIDE_SERIES: Record<GuideSeries, { label: string; hint: string }> = {
  IFL: { label: 'IFL', hint: 'Remitente y destinatario (IFLWH…)' },
  PKG: { label: 'PKG', hint: 'Guía de la caja, sigue el número del PKG' },
};

export const GUIDE_STATUS: Record<GuideStatus, StatusMeta> = {
  CREATED: { label: 'Creada', tone: 'info' },
  RETAINED: { label: 'Retenida en bodega', tone: 'warning' },
  IN_TRANSIT: { label: 'En tránsito', tone: 'accent' },
  DELIVERED: { label: 'Entregada', tone: 'success' },
  VOIDED: { label: 'Anulada', tone: 'danger' },
};

/** Estados que el personal puede poner a mano en una guía de la serie IFL. */
export const MANUAL_GUIDE_STATUSES: GuideStatus[] = ['CREATED', 'RETAINED', 'IN_TRANSIT', 'DELIVERED'];

export const ID_KIND: Record<IdKind, string> = {
  CEDULA: 'Cédula',
  PASSPORT: 'Pasaporte',
  RUC: 'RUC',
};

export const EC_PROVINCES = [
  'AZUAY', 'BOLÍVAR', 'CAÑAR', 'CARCHI', 'CHIMBORAZO', 'COTOPAXI', 'EL ORO', 'ESMERALDAS', 'GALÁPAGOS', 'GUAYAS',
  'IMBABURA', 'LOJA', 'LOS RÍOS', 'MANABÍ', 'MORONA SANTIAGO', 'NAPO', 'ORELLANA', 'PASTAZA', 'PICHINCHA',
  'SANTA ELENA', 'SANTO DOMINGO DE LOS TSÁCHILAS', 'SUCUMBÍOS', 'TUNGURAHUA', 'ZAMORA CHINCHIPE',
];

/** Las etiquetas y manifiestos van en mayúsculas, sin espacios sobrantes. */
export function upper(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('es');
}

/** Texto opcional: vacío = null. */
export function optional(value: unknown): string | null {
  return upper(value) || null;
}

/** Texto libre opcional que conserva mayúsculas/minúsculas (correo, notas). */
export function optionalRaw(value: unknown): string | null {
  return String(value ?? '').trim() || null;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface GuideInput {
  shipperId?: string;
  consigneeId?: string;
  contents?: string;
  itemCount?: number | string;
  weightLb?: number | string;
  declaredValue?: number | string;
  clientTracking?: string;
  notes?: string;
  deliverElsewhere?: boolean;
  finalDeliveryAddress?: string;
  retain?: boolean;
}

export interface GuideFields {
  contents: string;
  itemCount: number;
  weightLb: number;
  declaredValue: number;
  clientTracking: string | null;
  notes: string | null;
  finalDeliveryAddress: string | null;
}

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.').trim()));

/** Valida y normaliza los datos de una guía (crear o editar). */
export function normalizeGuideFields(input: GuideInput): { ok: true; value: GuideFields } | { ok: false; error: string } {
  const contents = upper(input.contents);
  if (!contents) return { ok: false, error: 'Indica el contenido del paquete' };
  if (contents.length > 160) return { ok: false, error: 'El contenido es demasiado largo (máximo 160 caracteres)' };

  const itemCount = toNumber(input.itemCount ?? 1);
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 999) return { ok: false, error: 'La cantidad de artículos debe ser un entero de 1 a 999' };

  const weight = toNumber(input.weightLb);
  if (!Number.isFinite(weight) || weight <= 0) return { ok: false, error: 'Indica el peso en libras' };
  if (weight > 999.99) return { ok: false, error: 'El peso máximo por guía es 999.99 lb' };

  const value = toNumber(input.declaredValue);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Indica el valor declarado en USD' };
  if (value > 99999) return { ok: false, error: 'El valor declarado es demasiado alto' };

  const finalAddress = input.deliverElsewhere ? upper(input.finalDeliveryAddress) : '';
  if (input.deliverElsewhere && !finalAddress) return { ok: false, error: 'Indica la dirección de entrega final' };

  return {
    ok: true,
    value: {
      contents,
      itemCount,
      weightLb: round2(weight),
      declaredValue: round2(value),
      clientTracking: optional(input.clientTracking),
      notes: optionalRaw(input.notes),
      finalDeliveryAddress: finalAddress || null,
    },
  };
}

/** Un remitente sin identificación, dirección, ciudad o teléfono no se puede declarar bien: se marca incompleto. */
export function shipperIsIncomplete(s: { idNumber: string | null; address: string | null; city: string | null; phone: string | null }): boolean {
  return !s.idNumber?.trim() || !s.address?.trim() || !s.city?.trim() || !s.phone?.trim();
}

/** "CUENCA, AZUAY, ECUADOR" (omite lo que falta). */
export function destinationLine(c: { city?: string | null; province?: string | null; country?: string | null }): string {
  return [c.city, c.province, c.country].map((p) => upper(p)).filter(Boolean).join(', ');
}

/** Códigos de país para el rótulo de la esquina de la etiqueta. */
export function countryTag(country: string | null | undefined): string {
  const c = upper(country);
  if (c === 'ECUADOR') return 'EC';
  if (c === 'PANAMÁ' || c === 'PANAMA') return 'PTY';
  return c.slice(0, 3);
}
