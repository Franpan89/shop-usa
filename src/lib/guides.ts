import 'server-only';
import prisma from '@/lib/prisma';
import { getTenantId, type Db } from '@/lib/tenant';
import { OPERATOR } from '@/config/site';
import { IFL_GUIDE_START, ID_KIND, countryTag, destinationLine, guideCode, upper } from '@/lib/domain/guides';

const IFL_COUNTER_KEY = 'guideIfl';

/** Siguiente número de la serie IFL (atómico). El primero es 100 → IFLWH00100. */
export async function nextIflNumber(db: Db, tenantId: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { tenantId_key: { tenantId, key: IFL_COUNTER_KEY } },
    create: { tenantId, key: IFL_COUNTER_KEY, value: IFL_GUIDE_START },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/** Crea la guía de un PKG (serie PKG, mismo número que la caja). Si ya tiene, devuelve la existente. */
export async function ensurePkgGuide(db: Db, pkg: { id: string; tenantId: string; number: number }, createdBy?: string | null) {
  const existing = await db.guide.findUnique({ where: { pkgId: pkg.id } });
  if (existing) return { guide: existing, created: false };
  const guide = await db.guide.create({
    data: {
      tenantId: pkg.tenantId,
      series: 'PKG',
      number: pkg.number,
      code: guideCode('PKG', pkg.number),
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
    const deliverTo = g.finalDeliveryAddress ?? c?.deliveryAddress ?? c?.declaredAddress ?? null;
    out.push({
      ...base,
      senderName: s?.name ?? '—',
      senderLines: [s?.address, [[s?.city, s?.state].filter(Boolean).join(', '), s?.phone ? `TEL ${s.phone}` : null].filter(Boolean).join(' · ')].filter((x): x is string => !!x),
      toTitle: 'CONSIGNEE',
      toName: c?.name ?? '—',
      // De más a menos importante: si el nombre ocupa dos renglones, lo primero que se recorta es la referencia.
      toLines: [
        [c?.idNumber ? `${ID_KIND[c.idKind].toUpperCase()} ${c.idNumber}` : null, c?.phone ? `TEL ${c.phone}` : null].filter(Boolean).join(' · '),
        deliverTo ? `${g.finalDeliveryAddress ? 'ENTREGAR EN: ' : ''}${deliverTo}` : null,
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
