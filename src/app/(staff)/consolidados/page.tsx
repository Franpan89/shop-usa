import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings, getTenantId } from '@/lib/tenant';
import { estimateShipping } from '@/lib/consolidation';
import { consolidationLabel, retentionDays, retentionLevel } from '@/lib/domain/flow';
import { invoiceBalanceOf } from '@/lib/logistics';
import { Alert, Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, Tabs, ToneBadge, longDateTime, money } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import { CloseButton, CutoffForm, WeeklyBatchButton, WeightEditor } from './ConsolidationControls';

export const dynamic = 'force-dynamic';

/** datetime-local usa hora local sin zona: se arma con el huso del servidor. */
function toLocalInput(d: Date | null): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function ConsolidadosPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  await requireStaff();
  const { vista = 'abiertos', q } = await searchParams;
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const all = await prisma.consolidation.findMany({
    where: {
      tenantId,
      OR: [{ status: 'OPEN', products: { some: { status: { not: 'CANCELLED' } } } }, { status: 'CLOSED', products: { some: { pkgId: null, status: 'RECEIVED' } } }],
      client: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } : undefined,
    },
    include: {
      client: { include: { shippingCategory: true } },
      products: { where: { status: { not: 'CANCELLED' } }, select: { origin: true, quantity: true, pkgId: true, status: true } },
      invoice: { select: { total: true, paidAmount: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const rows = all.map((c) => {
    const est = estimateShipping(c.realWeight, c.client.shippingCategory);
    const held = c.status === 'OPEN' && c.decision === 'HOLD';
    const days = held ? retentionDays(c.retentionStartedAt, now) : 0;
    const level = retentionLevel(days, held, settings.retentionWarningDays, settings.retentionMaxDays);
    const units = c.products.reduce((s, p) => s + p.quantity, 0);
    return { c, est, held, days, level, units };
  });

  const open = rows.filter((r) => r.c.status === 'OPEN' && r.c.decision === 'DISPATCH');
  const heldRows = rows.filter((r) => r.held);
  const closedRows = rows.filter((r) => r.c.status === 'CLOSED');
  const warnings = heldRows.filter((r) => r.level === 'warning' || r.level === 'overdue');
  const readyToClose = open.filter((r) => r.c.realWeight > 0 && r.c.client.shippingCategory);
  const view = vista === 'retenidos' ? heldRows : vista === 'cerrados' ? closedRows : open;

  const cutoff = settings.dispatchCutoffAt;
  const cutoffPassed = cutoff ? cutoff.getTime() < now.getTime() : false;

  return (
    <>
      <PageHeader title="Consolidados" subtitle="La mercancía de cada cliente se pesa una vez y junta; los productos siguen controlándose uno a uno." />

      <KpiGrid>
        <Kpi label="Abiertos (se despachan)" value={open.length} hint={`${readyToClose.length} listos para cerrar`} tone="accent" href="/consolidados?vista=abiertos" />
        <Kpi label="Retenidos" value={heldRows.length} hint="Mercancía retenida por el cliente" href="/consolidados?vista=retenidos" />
        <Kpi label="Retención prolongada" value={warnings.length} tone={warnings.length ? 'warning' : undefined} hint={`Desde ${settings.retentionWarningDays} días`} href="/consolidados?vista=retenidos" />
        <Kpi label="Listos para despacho" value={closedRows.length} hint="Cerrados, falta asignar a PKG" tone="success" href="/consolidados?vista=cerrados" />
      </KpiGrid>

      <Panel
        title="Cierre semanal"
        subtitle="Quien no pidió retener, despacha. Fija la fecha límite y, llegado el momento, cierra y factura."
        actions={<WeeklyBatchButton ready={readyToClose.length} />}
      >
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <CutoffForm value={toLocalInput(cutoff)} />
          <div className="small">
            {cutoff ? (
              cutoffPassed ? (
                <ToneBadge tone="danger">Pasó el límite · {longDateTime(cutoff)}</ToneBadge>
              ) : (
                <ToneBadge tone="info">Límite: {longDateTime(cutoff)}</ToneBadge>
              )
            ) : (
              <ToneBadge tone="warning">Sin fecha límite configurada</ToneBadge>
            )}
          </div>
        </div>
        {cutoffPassed && <div style={{ marginTop: 12 }}><Alert tone="warning">El plazo ya pasó: los clientes no pueden cambiar su decisión desde el portal. Cierra la semana y fija la próxima fecha límite.</Alert></div>}
      </Panel>

      <div style={{ height: 20 }} />
      <Tabs
        items={[
          { href: '/consolidados?vista=abiertos', label: 'Abiertos', count: open.length, active: vista === 'abiertos' },
          { href: '/consolidados?vista=retenidos', label: 'Retenidos', count: heldRows.length, active: vista === 'retenidos' },
          { href: '/consolidados?vista=cerrados', label: 'Cerrados · listos para despacho', count: closedRows.length, active: vista === 'cerrados' },
        ]}
      />
      <div className="filter-bar"><SearchFilter placeholder="Cliente o código…" /></div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>PRODUCTOS</th>
              <th>PESO REAL</th>
              <th>FACTURABLE</th>
              <th>TARIFA</th>
              <th className="text-right">ENVÍO</th>
              <th>ESTADO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.map(({ c, est, days, level, units }) => {
              const closed = c.status === 'CLOSED';
              const noRate = !c.client.shippingCategory;
              const reason = noRate ? 'El cliente no tiene tarifa de envío' : c.realWeight <= 0 ? 'Registra el peso primero' : undefined;
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/consolidados/${c.id}`} className="link strong">{c.client.name}</Link>
                    <div className="muted small mono">{c.client.code} · {c.client.country}</div>
                  </td>
                  <td>{c.products.length} <span className="muted small">({units} u.)</span></td>
                  <td>{closed ? `${c.realWeight.toFixed(2)} lb` : <WeightEditor consolidationId={c.id} weight={c.realWeight} />}</td>
                  <td>{closed ? `${c.billableWeight ?? 0} lb` : est.billableWeight ? `${est.billableWeight} lb` : '—'}</td>
                  <td className="small">{c.shippingCategoryName ?? est.categoryName ?? <span className="muted">Sin tarifa</span>}</td>
                  <td className="text-right strong">
                    {closed ? money(c.shippingCost ?? 0) : est.cost != null && c.realWeight > 0 ? <span title="Estimado: cambia si llegan más productos">≈ {money(est.cost)}</span> : '—'}
                    {closed && c.invoice && <div className="small">{invoiceBalanceOf(c.invoice) > 0.004 ? <span className="money-due">Debe {money(invoiceBalanceOf(c.invoice))}</span> : <span className="money-ok">Pagado</span>}</div>}
                  </td>
                  <td>
                    <StatusBadge meta={consolidationLabel(c.status, c.decision)} small />
                    {level !== 'none' && (
                      <div className="small" style={{ marginTop: 4, color: level === 'ok' ? 'var(--text-muted)' : '#f59e0b', fontWeight: level === 'ok' ? 400 : 700 }}>
                        {level === 'ok' ? '' : '⚠️ RETENCIÓN PROLONGADA · '}Retenido {days} día(s)
                      </div>
                    )}
                  </td>
                  <td className="nowrap">
                    {!closed && c.decision === 'DISPATCH' && <CloseButton consolidationId={c.id} disabledReason={reason} />}{' '}
                    <Link href={`/consolidados/${c.id}`} className="btn btn-secondary btn-sm">Abrir</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {view.length === 0 && <Empty icon="🧺" title="No hay consolidados en esta vista">Aparecen cuando se recibe mercancía de un cliente.</Empty>}
      </div>
    </>
  );
}
