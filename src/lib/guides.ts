import 'server-only';
import prisma from '@/lib/prisma';
import { getTenantId, type Db } from '@/lib/tenant';
import { OPERATOR } from '@/config/site';
import { IFL_GUIDE_START, ID_KIND, PKG_PREFIX, countryTag, destinationLine, guideCode, guideRef, upper } from '@/lib/domain/guides';

const IFL_COUNTER_KEY = 'guideIfl';

/** Siguiente número de guía (atómico), el mismo para todas. El primero es 100 → IFLWH00100. */
export async function nextIflNumber(db: Db, tenantId: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { tenantId_key: { tenantId, key: IFL_COUNTER_KEY } },
    create: { tenantId, key: IFL_COUNTER_KEY, value: IFL_GUIDE_START },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

const refCounterKey = (prefix: string) => `guideRef:${prefix}`;

/** Siguiente número de un identificador adicional (JM → 1, 2, 3…). Atómico. */
export async function nextRefNumber(db: Db, tenantId: string, prefix: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { tenantId_key: { tenantId, key: refCounterKey(prefix) } },
    create: { tenantId, key: refCounterKey(prefix), value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/** El próximo número que se asignaría a cada identificador (solo para mostrarlo en el formulario). */
export async function peekRefNumbers(db: Db, tenantId: string, prefixes: string[]): Promise<Record<string, number>> {
  if (!prefixes.length) return {};
  const rows = await db.counter.findMany({ where: { tenantId, key: { in: prefixes.map(refCounterKey) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(prefixes.map((p) => [p, (byKey.get(refCounterKey(p)) ?? 0) + 1]));
}

/** Deja listo el contador de un identificador nuevo para que su primer paquete sea `startAt`. */
export async function seedRefCounter(db: Db, tenantId: string, prefix: string, startAt: number) {
  await db.counter.upsert({
    where: { tenantId_key: { tenantId, key: refCounterKey(prefix) } },
    create: { tenantId, key: refCounterKey(prefix), value: startAt - 1 },
    update: { value: startAt - 1 },
  });
}

/**
 * Crea la guía de un PKG: numeración IFLWH como todas, con tracking PKG{n} (el número de la caja).
 * Si ya tiene, devuelve la existente.
 */
export async function ensurePkgGuide(db: Db, pkg: { id: string; tenantId: string; number: number }, createdBy?: string | null) {
  const existing = await db.guide.findUnique({ where: { pkgId: pkg.id } });
  if (existing) return { guide: existing, created: false };
  const number = await nextIflNumber(db, pkg.tenantId);
  const guide = await db.guide.create({
    data: {
      tenantId: pkg.tenantId,
      series: 'PKG',
      number,
      code: guideCode(number),
      refPrefix: PKG_PREFIX,
      refNumber: pkg.number,
      refCode: guideRef(PKG_PREFIX, pkg.number),
      pkgId: pkg.id,
      createdBy: createdBy ?? null,
    },
  });
  return { guide, created: true };
}

/** Todo lo que se imprime en una etiqueta, ya resuelto (serializable). */
export interface LabelData {
  id: string;
  code: string;
  series: 'IFL' | 'PKG';
  date: string;
  senderName: string;
  senderLines: string[];
  /** Destinatario (serie IFL) o resumen de la caja (serie PKG). */
  toTitle: string;
  toName: string;
  toLines: string[];
  destination: string;
  countryTag: string;
  weightLb: number | null;
  weightEstimated: boolean;
  pieces: number;
  description: string;
  declaredValue: number | null;
  clientTracking: string | null;
  /** Identificador que se imprime como tracking (PKG501, JM001). */
  refCode: string | null;
  retained: boolean;
  voided: boolean;
}

const labelDate = (d: Date) =>
  upper(d.toLocaleDateString('es-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/New_York' }).replace(/\./g, ''));

/** Datos de etiqueta de varias guías, en el orden pedido. Las que no existen se omiten. */
export async function getLabelData(ids: string[]): Promise<LabelData[]> {
  const tenantId = await getTenantId();
  const guides = await prisma.guide.findMany({
    where: { id: { in: ids }, tenantId },
    include: {
      shipper: true,
      consignee: true,
      pkg: {
        include: {
          products: {
            where: { status: { not: 'CANCELLED' } },
            select: { quantity: true, clientId: true, client: { select: { code: true } }, consolidationId: true, consolidation: { select: { realWeight: true } } },
          },
        },
      },
    },
  });
  const byId = new Map(guides.map((g) => [g.id, g]));

  const out: LabelData[] = [];
  for (const id of ids) {
    const g = byId.get(id);
    if (!g) continue;
    const base = {
      id: g.id,
      code: g.code,
      series: g.series,
      date: labelDate(g.createdAt),
      clientTracking: g.clientTracking,
      refCode: g.refCode ?? (g.pkg ? guideRef(PKG_PREFIX, g.pkg.number) : null),
      retained: g.status === 'RETAINED',
      voided: g.status === 'VOIDED',
    };

    if (g.series === 'PKG' && g.pkg) {
      const products = g.pkg.products;
      const codes = Array.from(new Set(products.map((p) => p.client.code))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
      const clients = codes.length;
      const units = products.reduce((s, p) => s + p.quantity, 0);
      // Sin peso propio, la caja pesa lo que suman los consolidados de sus clientes (estimado).
      const seen = new Map<string, number>();
      for (const p of products) if (p.consolidationId && p.consolidation) seen.set(p.consolidationId, p.consolidation.realWeight);
      const computed = Array.from(seen.values()).reduce((s, w) => s + w, 0);
      out.push({
        ...base,
        senderName: upper(OPERATOR),
        senderLines: ['ORLANDO, FL'],
        toTitle: 'CAJA CONSOLIDADA',
        toName: `${clients} ${clients === 1 ? 'CLIENTE' : 'CLIENTES'}`,
        // Los códigos ayudan a desconsolidar: se ve de un vistazo de quién es lo que trae la caja.
        toLines: [`${units} ${units === 1 ? 'UNIDAD' : 'UNIDADES'}`, ...(codes.length ? [`CLIENTES: ${codes.join(', ')}`] : [])],
        destination: upper(g.pkg.country),
        countryTag: countryTag(g.pkg.country),
        weightLb: g.weightLb ?? (computed > 0 ? computed : null),
        weightEstimated: g.weightLb == null,
        pieces: units,
        description: g.contents ?? 'MERCANCÍA CONSOLIDADA',
        declaredValue: g.declaredValue,
      });
      continue;
    }

    const s = g.shipper;
    const c = g.consignee;
    const dest = c ? destinationLine(c) : '';
    // La dirección es la del destinatario, tal como está guardada en Destinatarios (sin otra alterna).
    const deliverTo = c?.deliveryAddress ?? c?.declaredAddress ?? null;
    out.push({
      ...base,
      senderName: s?.name ?? '—',
      senderLines: [s?.address, [[s?.city, s?.state].filter(Boolean).join(', '), s?.phone ? `TEL ${s.phone}` : null].filter(Boolean).join(' · ')].filter((x): x is string => !!x),
      toTitle: 'CONSIGNEE',
      toName: c?.name ?? '—',
      // De más a menos importante: si el nombre ocupa dos renglones, lo primero que se recorta es la referencia.
      toLines: [
        [c?.idNumber ? `${ID_KIND[c.idKind].toUpperCase()} ${c.idNumber}` : null, c?.phone ? `TEL ${c.phone}` : null].filter(Boolean).join(' · '),
        deliverTo,
        c?.reference ? `REF: ${c.reference}` : null,
      ].filter((x): x is string => !!x),
      destination: dest || 'N/D',
      countryTag: countryTag(c?.country),
      weightLb: g.weightLb,
      weightEstimated: false,
      pieces: g.itemCount,
      description: g.contents ?? '',
      declaredValue: g.declaredValue,
    });
  }
  return out;
}
