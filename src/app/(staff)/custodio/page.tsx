import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings, getTenantId } from '@/lib/tenant';
import { Empty, Kpi, KpiGrid, PageHeader, Panel, ToneBadge, money, shortDate } from '@/components/ui/kit';
import { ActivateCustody, DeliverCustody } from './CustodyControls';

import { nowMs } from '@/lib/clock';

export const dynamic = 'force-dynamic';

const SIZE = { SMALL: 'Small', MEDIUM: 'Medium', LARGE: 'Large' } as const;

/** Custodio de paquetería (Etapa 9): qué clientes lo tienen activo, qué paquetes siguen en Orlando y cuánto se acumula. */
export default async function CustodioPage() {
  await requireStaff();
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const [clients, everyone] = await Promise.all([
    prisma.client.findMany({
      where: { tenantId, OR: [{ custodyActive: true }, { custodyPackages: { some: { status: 'IN_CUSTODY' } } }] },
      include: { custodyPackages: { orderBy: { receivedAt: 'desc' } } },
      orderBy: { custodyDeadline: 'asc' },
    }),
    prisma.client.findMany({ where: { tenantId, custodyActive: false }, select: { id: true, name: true, code: true, country: true }, orderBy: { name: 'asc' } }),
  ]);

  const now = nowMs();
  const inCustody = clients.reduce((s, c) => s + c.custodyPackages.filter((p) => p.status === 'IN_CUSTODY').length, 0);
  const accumulated = clients.reduce((s, c) => s + c.custodyPackages.filter((p) => p.status === 'IN_CUSTODY').reduce((x, p) => x + p.fee, 0), 0);
  const overdue = clients.filter((c) => c.custodyDeadline && c.custodyDeadline.getTime() < now && c.custodyPackages.some((p) => p.status === 'IN_CUSTODY')).length;

  return (
    <>
      <PageHeader
        title="Custodio de paquetería"
        subtitle="Recepción y custodia temporal de paquetes para turistas que viajan a Orlando. Se activa a mano por cliente y usa su mismo código y cuenta."
        actions={<Link href="/recepcion?vista=casillero" className="btn btn-mint">+ Recibir paquete</Link>}
      />

      <KpiGrid>
        <Kpi label="Clientes con custodio activo" value={clients.filter((c) => c.custodyActive).length} />
        <Kpi label="Paquetes en Orlando" value={inCustody} tone="accent" />
        <Kpi label="Cargos acumulados" value={money(accumulated)} hint="De paquetes aún en custodia" />
        <Kpi label="Fecha límite vencida" value={overdue} tone={overdue ? 'danger' : 'success'} hint="Con paquetes sin entregar" />
      </KpiGrid>

      <Panel title="Activar el servicio" subtitle="Cuando un cliente avisa que viajará a Orlando. No hay límite automático: la desactivación también es manual.">
        <ActivateCustody clients={everyone} />
      </Panel>
      <div style={{ height: 20 }} />

      {clients.length === 0 ? (
        <div className="glass-panel static"><Empty icon="🏠" title="Ningún cliente tiene custodio activo" /></div>
      ) : (
        <div className="stack">
          {clients.map((c) => {
            const held = c.custodyPackages.filter((p) => p.status === 'IN_CUSTODY');
            const late = c.custodyDeadline && c.custodyDeadline.getTime() < now;
            return (
              <Panel
                key={c.id}
                title={<><Link href={`/clientes/${c.id}`} className="link">{c.name}</Link> <span className="badge badge-accent mono badge-sm">{c.code}</span></>}
                subtitle={`${held.length} paquete(s) en custodia · acumulado ${money(held.reduce((s, p) => s + p.fee, 0))}`}
                actions={
                  <>
                    {c.custodyDeadline && <ToneBadge tone={late && held.length > 0 ? 'danger' : 'info'}>Hasta {shortDate(c.custodyDeadline)}{late && held.length > 0 ? ' · vencida' : ''}</ToneBadge>}
                    <ToneBadge tone={c.custodyActive ? 'success' : 'secondary'}>{c.custodyActive ? 'Activo' : 'Desactivado'}</ToneBadge>
                  </>
                }
              >
                {c.custodyPackages.length === 0 ? (
                  <p className="muted small">Todavía no se han recibido paquetes. <Link href="/recepcion?vista=casillero" className="link">Registrar uno</Link>.</p>
                ) : (
                  <DeliverCustody
                    clientId={c.id}
                    cfg={{ baseFee: settings.deliveryBaseFee, baseMiles: settings.deliveryBaseMiles, extraPerMile: settings.deliveryExtraPerMile }}
                    packages={c.custodyPackages.map((p) => ({
                      id: p.id,
                      sizeLabel: SIZE[p.size],
                      storeNote: p.storeNote,
                      receivedAt: shortDate(p.receivedAt),
                      fee: p.fee,
                      status: p.status,
                      deliveredLabel: p.deliveredAt ? `${p.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Retiro'} ${shortDate(p.deliveredAt)}` : null,
                    }))}
                  />
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
