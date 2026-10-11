import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { PKG_STATUS } from '@/lib/domain/flow';
import { dispatchCode, getCountryRuleMap, pkgCode, suggestNextPkgNumber } from '@/lib/logistics';
import { Empty, Kpi, KpiGrid, PageHeader, StatusBadge, Tabs, shortDate } from '@/components/ui/kit';
import SelectFilter from '@/components/SelectFilter';
import { NewPkgButton } from './PkgControls';

export const dynamic = 'force-dynamic';

export default async function CajasPage({ searchParams }: { searchParams: Promise<{ pais?: string; estado?: string }> }) {
  await requireStaff();
  const { pais, estado } = await searchParams;
  const tenantId = await getTenantId();
  const { rules } = await getCountryRuleMap();

  const [pkgs, pending, suggested] = await Promise.all([
    prisma.pkg.findMany({
      where: { tenantId, country: pais || undefined, status: estado ? (estado as 'CLOSED') : undefined },
      include: { products: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true, clientId: true } }, dispatch: { select: { id: true, number: true, country: true, date: true, status: true } } },
      orderBy: { number: 'desc' },
      take: 150,
    }),
    prisma.product.count({ where: { tenantId, status: 'RECEIVED', pkgId: null, consolidation: { status: 'CLOSED' } } }),
    suggestNextPkgNumber(prisma),
  ]);

  const inPrep = pkgs.filter((p) => p.status === 'IN_PREPARATION').length;
  const closedWaiting = pkgs.filter((p) => p.status === 'CLOSED' && !p.dispatchId).length;

  return (
    <>
      <PageHeader title="Cajas (PKG)" subtitle="Cada PKG es una caja física. Un PKG puede llevar productos de varios clientes y un cliente puede tener productos en varios PKG." actions={<NewPkgButton countries={rules.filter((r) => r.active).map((r) => r.name)} suggested={suggested} />} />

      <KpiGrid>
        <Kpi label="Productos sin PKG" value={pending} tone={pending ? 'warning' : 'success'} hint="Listos para despacho, pendientes de asignar" />
        <Kpi label="En preparación" value={inPrep} hint="Armándose en Orlando" />
        <Kpi label="Cerrados sin despacho" value={closedWaiting} hint="Esperando salir en un despacho" tone="accent" href="/despachos" />
      </KpiGrid>

      <Tabs items={[{ href: '/cajas', label: 'Todos los PKG', active: true }]} />
      <div className="filter-bar">
        <SelectFilter label="País" paramName="pais" allLabel="Todos" options={rules.map((r) => ({ value: r.name, label: r.name }))} />
        <SelectFilter label="Estado" paramName="estado" allLabel="Todos" options={Object.entries(PKG_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr><th>PKG</th><th>DESTINO</th><th>UNIDADES</th><th>CLIENTES</th><th>GUÍA</th><th>DESPACHO</th><th>ESTADO</th><th /></tr>
          </thead>
          <tbody>
            {pkgs.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/cajas/${p.id}`} className="link mono strong">{pkgCode(p.number)}</Link></td>
                <td>{p.country}</td>
                <td>{p.products.reduce((s, x) => s + x.quantity, 0)}</td>
                <td>{new Set(p.products.map((x) => x.clientId)).size}</td>
                <td className="mono small">{p.trackingNumber ?? <span className="muted">—</span>}</td>
                <td>{p.dispatch ? <Link href={`/despachos/${p.dispatch.id}`} className="link small">{dispatchCode(p.dispatch.number)} · {shortDate(p.dispatch.date)}</Link> : <span className="muted">—</span>}</td>
                <td><StatusBadge meta={PKG_STATUS[p.status]} small /></td>
                <td><Link href={`/cajas/${p.id}`} className="btn btn-secondary btn-sm">Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pkgs.length === 0 && <Empty icon="📦" title="Todavía no hay PKG">Crea el primero y asigna los productos listos para despacho.</Empty>}
      </div>
    </>
  );
}
