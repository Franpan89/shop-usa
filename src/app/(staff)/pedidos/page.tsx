import Link from 'next/link';
import type { OrderStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { ORDER_STATUS, ORDER_TYPE } from '@/lib/domain/flow';
import { invoiceBalanceOf, orderCode } from '@/lib/logistics';
import SearchFilter from '@/components/SearchFilter';
import SelectFilter from '@/components/SelectFilter';
import { Empty, PageHeader, StatusBadge, Tabs, money, shortDate } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; estado?: string; tipo?: string; clientId?: string }>;
}

const TABS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: '', label: 'Todos' },
  { key: 'pago', label: 'Por cobrar', statuses: ['PENDING_PAYMENT', 'PAYMENT_REVIEW'] },
  { key: 'comprar', label: 'Listos para comprar', statuses: ['READY_TO_BUY', 'PARTIALLY_PURCHASED'] },
  { key: 'bodega', label: 'Comprados / recibidos', statuses: ['PURCHASED', 'RECEIVED'] },
  { key: 'cancelados', label: 'Cancelados', statuses: ['CANCELLED'] },
];

export default async function PedidosPage({ searchParams }: Props) {
  await requireStaff();
  const { q, estado = '', tipo, clientId } = await searchParams;
  const tenantId = await getTenantId();

  const base: Prisma.OrderWhereInput = {
    tenantId,
    clientId: clientId || undefined,
    type: tipo === 'PERSONAL_SHOPPER' || tipo === 'CART' ? tipo : undefined,
    OR: q
      ? [
          { client: { name: { contains: q, mode: 'insensitive' } } },
          { client: { code: { contains: q, mode: 'insensitive' } } },
          ...(Number.isInteger(parseInt(q.replace('#', ''), 10)) ? [{ number: parseInt(q.replace('#', ''), 10) }] : []),
        ]
      : undefined,
  };
  const tab = TABS.find((t) => t.key === estado) ?? TABS[0];

  const [orders, grouped, client] = await Promise.all([
    prisma.order.findMany({
      where: { ...base, status: tab.statuses ? { in: tab.statuses } : undefined },
      include: {
        client: { select: { id: true, name: true, code: true } },
        invoice: { select: { total: true, paidAmount: true, status: true } },
        products: { select: { status: true } },
      },
      orderBy: { number: 'desc' },
      take: 200,
    }),
    prisma.order.groupBy({ by: ['status'], where: base, _count: true }),
    clientId ? prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null,
  ]);

  const countFor = (statuses?: OrderStatus[]) =>
    grouped.filter((g) => !statuses || statuses.includes(g.status)).reduce((s, g) => s + g._count, 0);
  const qs = (key: string) => {
    const p = new URLSearchParams();
    if (key) p.set('estado', key);
    if (q) p.set('q', q);
    if (tipo) p.set('tipo', tipo);
    if (clientId) p.set('clientId', clientId);
    const s = p.toString();
    return `/pedidos${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle={client ? `Pedidos de ${client.name}` : 'Personal Shopper y Compramos tu carrito. Cada pedido genera una factura en la cuenta del cliente.'}
        actions={<Link href={`/pedidos/nuevo${clientId ? `?clientId=${clientId}` : ''}`} className="btn btn-mint">+ Nuevo pedido</Link>}
      />

      <Tabs
        items={TABS.map((t) => ({
          href: qs(t.key),
          label: t.label,
          count: t.key === '' ? undefined : countFor(t.statuses),
          active: t.key === estado || (!estado && t.key === ''),
        }))}
      />

      <div className="filter-bar">
        <SearchFilter placeholder="Cliente, código o n.º de pedido (#012)…" />
        <SelectFilter
          label="Servicio"
          paramName="tipo"
          allLabel="Todos"
          options={[
            { value: 'PERSONAL_SHOPPER', label: 'Personal Shopper' },
            { value: 'CART', label: 'Compramos tu carrito' },
          ]}
        />
        {clientId && <Link href="/pedidos" className="link small">✕ Quitar filtro de cliente</Link>}
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>PEDIDO</th>
              <th>CLIENTE</th>
              <th>SERVICIO</th>
              <th>FECHA</th>
              <th>PRODUCTOS</th>
              <th className="text-right">TOTAL</th>
              <th className="text-right">PENDIENTE</th>
              <th>ESTADO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const live = o.products.filter((p) => p.status !== 'CANCELLED');
              const purchased = live.filter((p) => ['PURCHASED', 'RECEIVED', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED'].includes(p.status)).length;
              const due = invoiceBalanceOf(o.invoice);
              return (
                <tr key={o.id}>
                  <td><Link href={`/pedidos/${o.id}`} className="link mono strong">{orderCode(o.number)}</Link></td>
                  <td>
                    <Link href={`/clientes/${o.client.id}`} className="link">{o.client.name}</Link>
                    <div className="muted small mono">{o.client.code}</div>
                  </td>
                  <td>{ORDER_TYPE[o.type].icon} {ORDER_TYPE[o.type].short}</td>
                  <td className="nowrap">{shortDate(o.orderDate)}</td>
                  <td>{purchased}/{live.length} comprados</td>
                  <td className="text-right">{money(o.totalAmount)}</td>
                  <td className="text-right">{o.cancelledAt ? <span className="muted">—</span> : due > 0.004 ? <span className="money-due">{money(due)}</span> : <span className="money-ok">Pagado</span>}</td>
                  <td><StatusBadge meta={ORDER_STATUS[o.status]} small /></td>
                  <td><Link href={`/pedidos/${o.id}`} className="btn btn-secondary btn-sm">Ver</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && <Empty icon="🛒" title="No hay pedidos en esta vista">Crea un pedido o cambia los filtros.</Empty>}
      </div>
    </>
  );
}
