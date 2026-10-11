import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings, getTenantId } from '@/lib/tenant';
import { ORIGIN } from '@/lib/domain/flow';
import { orderCode } from '@/lib/logistics';
import { Empty, PageHeader, Tabs, longDateTime } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import Thumb from '@/components/ui/Thumb';
import ReceiveList, { type ReceiveGroup } from './ReceiveList';
import CasilleroReception from './CasilleroReception';
import RecentRow from './RecentRow';

import { nowMs } from '@/lib/clock';

export const dynamic = 'force-dynamic';

export default async function RecepcionPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  await requireStaff();
  const { vista = 'comprados', q } = await searchParams;
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const searchWhere = q
    ? [
        { name: { contains: q, mode: 'insensitive' as const } },
        { client: { name: { contains: q, mode: 'insensitive' as const } } },
        { client: { code: { contains: q, mode: 'insensitive' as const } } },
      ]
    : undefined;

  const [awaiting, awaitingCount, recent, clients] = await Promise.all([
    vista === 'comprados'
      ? prisma.product.findMany({
          where: { tenantId, status: 'PURCHASED', origin: { not: 'CASILLERO' }, OR: searchWhere },
          include: { client: { select: { id: true, name: true, code: true } }, order: { select: { id: true, number: true } } },
          orderBy: [{ client: { name: 'asc' } }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.product.count({ where: { tenantId, status: 'PURCHASED', origin: { not: 'CASILLERO' } } }),
    vista === 'recientes'
      ? prisma.product.findMany({
          where: { tenantId, receivedAt: { gte: new Date(nowMs() - 7 * 86_400_000) }, OR: searchWhere },
          include: { client: { select: { id: true, name: true, code: true } }, consolidation: { select: { id: true, status: true } } },
          orderBy: { receivedAt: 'desc' },
          take: 150,
        })
      : Promise.resolve([]),
    vista === 'casillero'
      ? prisma.client.findMany({
          where: { tenantId },
          include: { consolidations: { where: { status: 'OPEN' }, select: { products: { where: { status: { not: 'CANCELLED' } }, select: { id: true } } } } },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const groups = new Map<string, ReceiveGroup>();
  for (const p of awaiting) {
    if (!groups.has(p.client.id)) groups.set(p.client.id, { clientId: p.client.id, clientName: p.client.name, clientCode: p.client.code, items: [] });
    groups.get(p.client.id)!.items.push({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      imageUrl: p.imageUrl,
      origin: p.origin === 'CART' ? 'CART' : 'PERSONAL_SHOPPER',
      orderId: p.order?.id ?? null,
      orderCode: p.order ? orderCode(p.order.number) : null,
    });
  }

  return (
    <>
      <PageHeader title="Recepción" subtitle="Cuando la mercancía llega a Shop USA solo se marca como recibida: pasa sola al consolidado abierto del cliente." />
      <Tabs
        items={[
          { href: '/recepcion?vista=comprados', label: 'Por recibir (PS y Carrito)', count: awaitingCount, active: vista === 'comprados' },
          { href: '/recepcion?vista=casillero', label: 'Casillero', active: vista === 'casillero' },
          { href: '/recepcion?vista=recientes', label: 'Recibidos esta semana', active: vista === 'recientes' },
        ]}
      />

      {vista === 'comprados' && (
        <>
          <div className="filter-bar"><SearchFilter placeholder="Buscar por cliente, código o producto…" /></div>
          {groups.size === 0 ? (
            <div className="glass-panel static"><Empty icon="📥" title="No hay compras esperando llegada">Los productos marcados como comprados aparecerán aquí hasta que lleguen.</Empty></div>
          ) : (
            <ReceiveList groups={Array.from(groups.values())} />
          )}
        </>
      )}

      {vista === 'casillero' && (
        <CasilleroReception
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            country: c.country,
            custodyActive: c.custodyActive,
            custodyDeadline: c.custodyDeadline ? c.custodyDeadline.toISOString().slice(0, 10) : null,
            openItems: c.consolidations.reduce((s, x) => s + x.products.length, 0),
          }))}
          fees={{ small: settings.custodySmallFee, medium: settings.custodyMediumFee, large: settings.custodyLargeFee }}
        />
      )}

      {vista === 'recientes' && (
        <>
          <div className="filter-bar"><SearchFilter placeholder="Buscar por cliente, código o producto…" /></div>
          <div className="glass-panel static">
            {recent.length === 0 ? (
              <Empty icon="🕒" title="Nada recibido en los últimos 7 días" />
            ) : (
              recent.map((p) => (
                <div key={p.id} className="group-row">
                  <Thumb src={p.imageUrl} alt={p.name} />
                  <div className="grow">
                    <div className="strong">{p.name}{p.quantity > 1 ? ` (x${p.quantity})` : ''}</div>
                    <div className="muted small">{p.client.name} · <span className="mono">{p.client.code}</span> · {ORIGIN[p.origin].icon} {ORIGIN[p.origin].label}</div>
                  </div>
                  <span className="muted small">{longDateTime(p.receivedAt)}</span>
                  <RecentRow productId={p.id} canDelete={p.origin === 'CASILLERO' && !p.pkgId && p.consolidation?.status !== 'CLOSED'} />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
