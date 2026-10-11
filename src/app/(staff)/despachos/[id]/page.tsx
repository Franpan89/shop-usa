import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { PKG_STATUS } from '@/lib/domain/flow';
import { dispatchCode, pkgCode } from '@/lib/logistics';
import { Alert, Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, ToneBadge, qty, shortDate } from '@/components/ui/kit';
import PrintButton from '../../clientes/[id]/estado-de-cuenta/PrintButton';
import { AvailablePkgs, ConfirmDispatchButton, DeleteDispatchButton, RemovePkgButton } from '../DispatchControls';

export const dynamic = 'force-dynamic';

export default async function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      pkgs: {
        orderBy: { number: 'asc' },
        include: { products: { where: { status: { not: 'CANCELLED' } }, include: { client: { select: { id: true, name: true, code: true } } } } },
      },
    },
  });
  if (!dispatch) notFound();

  const draft = dispatch.status === 'DRAFT';
  const available = draft
    ? await prisma.pkg.findMany({
        where: { tenantId: dispatch.tenantId, status: 'CLOSED', dispatchId: null, country: dispatch.country },
        include: { products: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true, clientId: true } } },
        orderBy: { number: 'asc' },
      })
    : [];

  const units = dispatch.pkgs.reduce((s, p) => s + p.products.reduce((x, y) => x + y.quantity, 0), 0);
  const clients = new Set(dispatch.pkgs.flatMap((p) => p.products.map((x) => x.clientId))).size;

  return (
    <>
      <PageHeader
        back={{ href: '/despachos', label: 'Despachos' }}
        title={`${dispatchCode(dispatch.number)} — ${dispatch.country}`}
        badges={draft ? <ToneBadge tone="warning">Borrador</ToneBadge> : <ToneBadge tone="success">Salió {shortDate(dispatch.confirmedAt)}</ToneBadge>}
        subtitle={`Salida ${shortDate(dispatch.date)}`}
        actions={
          <>
            {draft && <ConfirmDispatchButton dispatchId={dispatch.id} disabled={dispatch.pkgs.length === 0} />}
            {draft && <DeleteDispatchButton dispatchId={dispatch.id} />}
            <PrintButton />
          </>
        }
      />

      <KpiGrid>
        <Kpi label="PKG" value={dispatch.pkgs.length} />
        <Kpi label="Unidades" value={units} />
        <Kpi label="Clientes" value={clients} />
      </KpiGrid>

      {draft && <Alert tone="info">Mientras el despacho esté en borrador los productos siguen <strong>en bodega</strong>. Solo al confirmarlo pasan a <strong>en tránsito</strong> y se avisa a los clientes.</Alert>}

      <div className="page-grid">
        <div className="stack">
          {dispatch.pkgs.length === 0 && <div className="glass-panel static"><Empty icon="📦" title="Sin PKG en este despacho">Agrega PKG cerrados desde la derecha.</Empty></div>}
          {dispatch.pkgs.map((p) => {
            const byClient = new Map<string, { name: string; code: string; items: typeof p.products }>();
            for (const x of p.products) {
              if (!byClient.has(x.client.id)) byClient.set(x.client.id, { name: x.client.name, code: x.client.code, items: [] });
              byClient.get(x.client.id)!.items.push(x);
            }
            return (
              <Panel
                key={p.id}
                title={<Link href={`/cajas/${p.id}`} className="link mono">{pkgCode(p.number)}</Link>}
                subtitle={`${p.products.reduce((s, x) => s + x.quantity, 0)} unidad(es)${p.trackingNumber ? ` · guía ${p.trackingNumber}` : ''}`}
                actions={<><StatusBadge meta={PKG_STATUS[p.status]} small />{draft && <RemovePkgButton pkgId={p.id} />}</>}
              >
                <div className="stack-sm small">
                  {Array.from(byClient.values()).map((g) => (
                    <div key={g.code}>
                      <strong>{g.name}</strong> <span className="muted mono">{g.code}</span>
                      <div className="muted">{g.items.map((i) => qty(i.name, i.quantity)).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>

        {draft && (
          <Panel title="PKG cerrados disponibles" subtitle={`Destino ${dispatch.country}, todavía sin despacho.`}>
            <AvailablePkgs dispatchId={dispatch.id} pkgs={available.map((p) => ({ id: p.id, code: pkgCode(p.number), units: p.products.reduce((s, x) => s + x.quantity, 0), clients: new Set(p.products.map((x) => x.clientId)).size }))} />
          </Panel>
        )}
      </div>
    </>
  );
}
