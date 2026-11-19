import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { GUIDE_SERIES, GUIDE_STATUS } from '@/lib/domain/guides';
import { PKG_STATUS } from '@/lib/domain/flow';
import { Empty, Kpi, KpiGrid, PageHeader, StatusBadge, money } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import SelectFilter from '@/components/SelectFilter';
import CheckFilter from '@/components/CheckFilter';
import { GuideRowActions, PrintVisibleButton } from './GuideControls';

export const dynamic = 'force-dynamic';

const LIMIT = 300;

interface Props {
  searchParams: Promise<{ q?: string; serie?: string; ident?: string; estado?: string; retenidas?: string; sinimprimir?: string }>;
}

const fmtDate = (d: Date) => d.toLocaleString('es-US', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });

export default async function VerGuiasPage({ searchParams }: Props) {
  await requireStaff();
  const { q, serie, ident, estado, retenidas, sinimprimir } = await searchParams;
  const tenantId = await getTenantId();

  const where: Prisma.GuideWhereInput = {
    tenantId,
    series: serie === 'IFL' || serie === 'PKG' ? serie : undefined,
    refPrefix: ident?.trim() ? ident.trim().toUpperCase() : undefined,
    status: retenidas === '1' ? 'RETAINED' : estado && estado in GUIDE_STATUS ? (estado as keyof typeof GUIDE_STATUS) : undefined,
    printCount: sinimprimir === '1' ? 0 : undefined,
    OR: q?.trim()
      ? [
          { code: { contains: q.trim(), mode: 'insensitive' } },
          { refCode: { contains: q.trim(), mode: 'insensitive' } },
          { clientTracking: { contains: q.trim(), mode: 'insensitive' } },
          { contents: { contains: q.trim(), mode: 'insensitive' } },
          { shipper: { name: { contains: q.trim(), mode: 'insensitive' } } },
          { consignee: { name: { contains: q.trim(), mode: 'insensitive' } } },
        ]
      : undefined,
  };

  const [guides, total, retainedCount, unprinted, identifiers] = await Promise.all([
    prisma.guide.findMany({
      where,
      include: { shipper: { select: { name: true } }, consignee: { select: { name: true, city: true, country: true } }, pkg: { select: { id: true, country: true, status: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: LIMIT,
    }),
    prisma.guide.count({ where }),
    prisma.guide.count({ where: { tenantId, status: 'RETAINED' } }),
    prisma.guide.count({ where: { tenantId, printCount: 0, status: { not: 'VOIDED' } } }),
    prisma.guideIdentifier.findMany({ where: { tenantId }, orderBy: { prefix: 'asc' }, select: { prefix: true } }),
  ]);

  const live = guides.filter((g) => g.status !== 'VOIDED');
  const totalWeight = live.reduce((s, g) => s + (g.weightLb ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Guías"
        title="Ver guías"
        subtitle="Todas las guías salen como IFLWH y llevan su PKG o identificador como tracking. Reimprime, edita, retén en bodega o anula."
        actions={
          <>
            <PrintVisibleButton ids={live.map((g) => g.id)} />
            <Link href="/guias/nueva" className="btn btn-mint">+ Crear guía</Link>
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Guías" value={total} hint={total > LIMIT ? `Mostrando las últimas ${LIMIT}` : 'Con los filtros actuales'} />
        <Kpi label="Peso visible" value={`${totalWeight.toFixed(2)} lb`} hint="Suma de las guías de la lista (sin anuladas)" />
        <Kpi label="Retenidas en bodega" value={retainedCount} tone={retainedCount ? 'warning' : undefined} href="/guias?retenidas=1" />
        <Kpi label="Sin imprimir" value={unprinted} tone={unprinted ? 'accent' : undefined} href="/guias?sinimprimir=1" hint="Aún no tienen etiqueta" />
      </KpiGrid>

      <div className="filter-bar">
        <SearchFilter placeholder="Número, PKG, tracking, remitente, destinatario o contenido…" />
        <SelectFilter label="Tipo" paramName="serie" allLabel="Todos" options={Object.entries(GUIDE_SERIES).map(([value, m]) => ({ value, label: `${m.label} · ${m.hint}` }))} />
        <SelectFilter label="Identificador" paramName="ident" allLabel="Todos" options={[{ value: 'PKG', label: 'PKG' }, ...identifiers.map((i) => ({ value: i.prefix, label: i.prefix }))]} />
        <SelectFilter label="Estado" paramName="estado" allLabel="Todos" options={Object.entries(GUIDE_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
        <CheckFilter label="Solo retenidas" paramName="retenidas" />
        <CheckFilter label="Solo sin imprimir" paramName="sinimprimir" />
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>GUÍA</th><th>TRACKING</th><th>FECHA</th><th>REMITENTE</th><th>DESTINATARIO</th><th>CIUDAD</th><th>PESO</th><th>VALOR</th><th>ESTADO</th><th />
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => {
              const isPkg = g.series === 'PKG';
              const status = isPkg && g.pkg ? PKG_STATUS[g.pkg.status] : GUIDE_STATUS[g.status];
              return (
                <tr key={g.id} style={g.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                  <td>
                    {isPkg && g.pkg ? (
                      <Link href={`/cajas/${g.pkg.id}`} className="link mono strong">{g.code}</Link>
                    ) : (
                      <strong className="mono">{g.code}</strong>
                    )}
                    {g.printCount === 0 && g.status !== 'VOIDED' && <div><span className="badge badge-secondary badge-sm">Sin imprimir</span></div>}
                  </td>
                  <td className="mono strong">{g.refCode ?? <span className="muted">—</span>}</td>
                  <td className="small">{fmtDate(g.createdAt)}</td>
                  <td>{isPkg ? <span className="muted">Caja consolidada</span> : g.shipper?.name ?? '—'}</td>
                  <td>
                    {isPkg ? <span className="muted">—</span> : g.consignee?.name ?? '—'}
                    {g.clientTracking && <div className="small muted mono">{g.clientTracking}</div>}
                  </td>
                  <td>{isPkg ? g.pkg?.country : g.consignee?.city ?? '—'}</td>
                  <td>{g.weightLb != null ? `${g.weightLb.toFixed(2)} lb` : <span className="muted">—</span>}</td>
                  <td>{g.declaredValue != null ? money(g.declaredValue) : <span className="muted">—</span>}</td>
                  <td><StatusBadge meta={status} small /></td>
                  <td>
                    <GuideRowActions
                      guide={{
                        id: g.id,
                        code: g.code,
                        series: g.series,
                        status: g.status,
                        contents: g.contents ?? '',
                        itemCount: g.itemCount,
                        weightLb: g.weightLb,
                        declaredValue: g.declaredValue,
                        clientTracking: g.clientTracking ?? '',
                        notes: g.notes ?? '',
                        refPrefix: g.refPrefix ?? '',
                        refNumber: g.refNumber,
                        refCode: g.refCode ?? '',
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {guides.length === 0 && (
          <Empty icon="🏷️" title={q || serie || ident || estado || retenidas || sinimprimir ? 'No hay guías con esos filtros' : 'Todavía no hay guías'}>
            Crea la primera desde “Crear guía”; la guía de una caja sale al crear un PKG.
          </Empty>
        )}
      </div>
    </>
  );
}
