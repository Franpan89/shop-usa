import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { PKG_STATUS, isDispatchAuthorized } from '@/lib/domain/flow';
import { dispatchCode, getCountryRuleMap, invoiceBalanceOf, pkgCode } from '@/lib/logistics';
import { Alert, Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, qty } from '@/components/ui/kit';
import Thumb from '@/components/ui/Thumb';
import PrintButton from '../../clientes/[id]/estado-de-cuenta/PrintButton';
import { PkgInfoForm, PkgItemActions, PkgPool, PkgStateButtons, PkgStatusControl, type PoolGroup } from '../PkgControls';

export const dynamic = 'force-dynamic';

export default async function PkgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const pkg = await prisma.pkg.findUnique({
    where: { id },
    include: {
      dispatch: true,
      products: {
        where: { status: { not: 'CANCELLED' } },
        include: { client: { select: { id: true, name: true, code: true } } },
        orderBy: [{ client: { name: 'asc' } }, { createdAt: 'asc' }],
      },
    },
  });
  if (!pkg) notFound();

  const editable = pkg.status === 'IN_PREPARATION';
  const { ruleFor } = await getCountryRuleMap();

  const [poolProducts, others] = await Promise.all([
    editable
      ? prisma.product.findMany({
          where: { tenantId: pkg.tenantId, status: 'RECEIVED', pkgId: null, consolidation: { status: 'CLOSED' }, client: { country: pkg.country } },
          include: { client: { select: { id: true, name: true, code: true } }, consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true } } } } },
          orderBy: [{ client: { name: 'asc' } }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    editable ? prisma.pkg.findMany({ where: { tenantId: pkg.tenantId, status: 'IN_PREPARATION', country: pkg.country, id: { not: id } }, orderBy: { number: 'asc' } }) : Promise.resolve([]),
  ]);

  const rule = ruleFor(pkg.country);
  const poolMap = new Map<string, PoolGroup>();
  for (const p of poolProducts) {
    const balance = invoiceBalanceOf(p.consolidation?.invoice);
    if (!poolMap.has(p.client.id)) poolMap.set(p.client.id, { clientId: p.client.id, clientName: p.client.name, clientCode: p.client.code, items: [] });
    poolMap.get(p.client.id)!.items.push({ id: p.id, name: p.name, quantity: p.quantity, imageUrl: p.imageUrl, authorized: isDispatchAuthorized(balance, rule), balance });
  }

  const byClient = new Map<string, { name: string; code: string; id: string; items: typeof pkg.products }>();
  for (const p of pkg.products) {
    if (!byClient.has(p.client.id)) byClient.set(p.client.id, { id: p.client.id, name: p.client.name, code: p.client.code, items: [] });
    byClient.get(p.client.id)!.items.push(p);
  }
  const totalUnits = pkg.products.reduce((s, p) => s + p.quantity, 0);

  return (
    <>
      <PageHeader
        back={{ href: '/cajas', label: 'Cajas (PKG)' }}
        title={pkgCode(pkg.number)}
        badges={<StatusBadge meta={PKG_STATUS[pkg.status]} />}
        subtitle={`Destino ${pkg.country}${pkg.dispatch ? ` · ${dispatchCode(pkg.dispatch.number)}` : ''}`}
        actions={
          <>
            <PkgStateButtons pkgId={pkg.id} status={pkg.status} canClose={pkg.products.length > 0} hasDispatch={!!pkg.dispatch} />
            <PrintButton />
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Total de unidades" value={totalUnits} hint="Referencia para la declaración aduanera" />
        <Kpi label="Productos" value={pkg.products.length} />
        <Kpi label="Clientes en la caja" value={byClient.size} />
        <Kpi label="Despacho" value={pkg.dispatch ? dispatchCode(pkg.dispatch.number) : '—'} href={pkg.dispatch ? `/despachos/${pkg.dispatch.id}` : undefined} hint={pkg.dispatch ? (pkg.dispatch.status === 'CONFIRMED' ? 'Confirmado' : 'Borrador') : 'Aún sin despacho'} />
      </KpiGrid>

      {editable && <Alert tone="info">PKG <strong>en preparación</strong>: agrega, retira o mueve productos. El sistema no decide cómo empacar; registra lo que tú decides. Un producto solo pasa a “en tránsito” cuando el despacho se confirma.</Alert>}

      <div className="page-grid">
        <div className="stack">
          <Panel title="Contenido de la caja" subtitle="Agrupado por cliente. Esta vista sirve de referencia para la declaración aduanera externa." flush>
            <div style={{ padding: '0 18px 18px' }}>
              {byClient.size === 0 ? (
                <Empty icon="📦" title="El PKG está vacío">{editable ? 'Selecciona productos en la lista de pendientes.' : undefined}</Empty>
              ) : (
                Array.from(byClient.values()).map((g) => (
                  <div key={g.id} className="group-card">
                    <div className="group-head">
                      <div className="row"><Link href={`/clientes/${g.id}`} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{g.name}</Link><span className="badge badge-accent mono badge-sm">{g.code}</span></div>
                      <span className="muted small">{g.items.reduce((s, i) => s + i.quantity, 0)} unidad(es)</span>
                    </div>
                    {g.items.map((p) => (
                      <div key={p.id} className="group-row">
                        <Thumb src={p.imageUrl} alt={p.name} />
                        <div className="grow strong">{qty(p.name, p.quantity)}</div>
                        <PkgItemActions productId={p.id} editable={editable} others={others.map((o) => ({ id: o.id, label: pkgCode(o.number) }))} />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </Panel>

          {editable && (
            <Panel title="Productos pendientes de asignación" subtitle={`Listos para despacho a ${pkg.country} y todavía sin PKG. Los de un cliente con saldo no aparecen seleccionables si el país exige pago previo.`}>
              <PkgPool pkgId={pkg.id} groups={Array.from(poolMap.values())} />
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="Datos del PKG">
            <PkgInfoForm pkgId={pkg.id} number={pkg.number} trackingNumber={pkg.trackingNumber} carrier={pkg.carrier} notes={pkg.notes} numberEditable={editable} />
          </Panel>
          {pkg.dispatch?.status === 'CONFIRMED' && (
            <Panel title="Seguimiento">
              <PkgStatusControl pkgId={pkg.id} status={pkg.status} />
              <p className="muted small" style={{ marginTop: 10 }}>El cliente solo ve: En bodega → En tránsito → Listo para retirar → Entregado. No ve PKG ni guías.</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
