import prisma from '@/lib/prisma';
import Link from 'next/link';
import NewOrderModal from './NewOrderModal';
import OrderActionsCell from './OrderActionsCell';
import {
  ORDER_STATUSES,
  STATUS_ICON,
  STATUS_SHORT_LABEL_ES,
  normalizeOrderStatus,
  statusBadgeClass,
  statusLabel,
  type OrderStatus,
} from '@/lib/orderStatus';

interface Props {
  searchParams: Promise<{ status?: string; clientId?: string }>;
}

export default async function PedidosPage({ searchParams }: Props) {
  const { status: statusParam, clientId: clientIdParam } = await searchParams;
  const activeStatus: OrderStatus | 'ALL' =
    statusParam && ORDER_STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : 'ALL';

  const tenant = await prisma.tenant.findFirst();

  const filterClient = clientIdParam && tenant
    ? await prisma.client.findFirst({
        where: { id: clientIdParam, tenantId: tenant.id },
        select: { id: true, name: true, code: true },
      })
    : null;

  const clients = tenant ? await prisma.client.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, code: true, serviceFeePercent: true, country: true, shippingRatePerHalfLb: true },
    orderBy: { name: 'asc' }
  }) : [];

  const shippingRatesList = tenant ? await prisma.shippingCountryRate.findMany({
    where: { tenantId: tenant.id },
  }) : [];
  const shippingRates: Record<string, number> = Object.fromEntries(
    shippingRatesList.map(r => [r.country, r.ratePerHalfLb])
  );

  const catalog = tenant ? await prisma.productCatalog.findMany({
    where: { tenantId: tenant.id },
    select: {
      name: true,
      defaultWeight: true,
      defaultPurchaseValue: true,
      defaultPurchasedBy: true,
    },
    orderBy: [{ timesShipped: 'desc' }, { name: 'asc' }],
  }) : [];

  const allOrders = tenant ? await prisma.order.findMany({
    where: {
      tenantId: tenant.id,
      ...(filterClient ? { clientId: filterClient.id } : {}),
    },
    include: {
      client: true,
      box: true,
      products: true,
    },
    orderBy: { orderDate: 'desc' }
  }) : [];

  const counts: Record<OrderStatus | 'ALL', number> = {
    ALL: allOrders.length,
    READY_TO_SHIP: 0,
    SHIPPED: 0,
    ARRIVED: 0,
    DELIVERED: 0,
  };
  for (const o of allOrders) counts[normalizeOrderStatus(o.status)]++;

  const orders = activeStatus === 'ALL'
    ? allOrders
    : allOrders.filter(o => normalizeOrderStatus(o.status) === activeStatus);

  const availableBoxes = tenant ? await prisma.box.findMany({
    where: { tenantId: tenant.id, status: 'IN_TRANSIT' },
    select: { id: true, internalId: true, status: true },
    orderBy: { createdAt: 'desc' },
  }) : [];

  const tabs: Array<{ key: OrderStatus | 'ALL'; label: string; icon?: string }> = [
    { key: 'ALL', label: 'Todos' },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: STATUS_SHORT_LABEL_ES[s], icon: STATUS_ICON[s] })),
  ];

  const buildHref = (key: OrderStatus | 'ALL') => {
    const params = new URLSearchParams();
    if (key !== 'ALL') params.set('status', key);
    if (filterClient) params.set('clientId', filterClient.id);
    const qs = params.toString();
    return qs ? `/pedidos?${qs}` : '/pedidos';
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">
            {filterClient ? (
              <>
                Historial de <strong>{filterClient.name}</strong> ({filterClient.code})
              </>
            ) : (
              'Lista de pedidos con información de asignación de productos a cajas.'
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {filterClient && (
            <Link href="/pedidos" className="btn btn-secondary">
              ✕ Quitar filtro
            </Link>
          )}
          <NewOrderModal
            clients={clients}
            shippingRates={shippingRates}
            catalog={catalog}
            initialClientId={filterClient?.id}
          />
        </div>
      </header>

      <div className="status-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const isActive = activeStatus === tab.key;
          const href = buildHref(tab.key);
          return (
            <Link
              key={tab.key}
              href={href}
              className={`glass-panel ${isActive ? 'status-tab-active' : ''}`}
              style={{
                padding: '10px 18px',
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--text-color)',
                background: isActive ? 'var(--accent-color)' : undefined,
                fontWeight: isActive ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.95rem',
                transition: 'all 0.15s',
                border: isActive ? 'none' : '1px solid rgba(128,128,128,0.15)',
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '22px',
                  height: '22px',
                  padding: '0 7px',
                  borderRadius: '11px',
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.12)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {counts[tab.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="filter-bar">
        <div className="input-container" style={{ flex: 1, minWidth: '200px' }}>
          <label>Buscar Cliente</label>
          <input type="text" className="input-field" placeholder="Nombre del cliente..." />
        </div>
        <div className="input-container">
          <label>Fecha Inicial</label>
          <input type="date" className="input-field" />
        </div>
        <div className="input-container">
          <label>Fecha Final</label>
          <input type="date" className="input-field" />
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>PEDIDO / PAÍS</th>
              <th>FECHA ⬇</th>
              <th>ESTADO</th>
              <th>PRODUCTOS</th>
              <th>PESO</th>
              <th>CAJA</th>
              <th>TOTAL / BALANCE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/clientes/${order.client.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <strong>{order.client.name}</strong>
                  </Link>
                  <br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.client.code}</span>
                </td>
                <td>
                  <Link href={`/pedidos/${order.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>
                    ID Pedido: {order.id.slice(-4).toUpperCase()}
                  </Link>
                  <br/>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: {order.client.country.slice(0, 2).toUpperCase()}</span>
                </td>
                <td>{new Date(order.orderDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </td>
                <td>{order.products.length} prod.</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {order.products.reduce((s, p) => s + p.weight, 0).toFixed(2)} lbs
                </td>
                <td>
                  {order.box ? (
                    <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>📦 {order.box.internalId}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Sin caja</span>
                  )}
                </td>
                <td>
                  <strong>${order.totalAmount.toFixed(2)}</strong><br/>
                  <span style={{ fontSize: '0.8rem', color: order.balance > 0 ? '#ef4444' : '#10b981' }}>
                    Bal: ${order.balance.toFixed(2)}
                  </span>
                </td>
                <td>
                  <OrderActionsCell
                    orderId={order.id}
                    currentBoxId={order.boxId}
                    currentStatus={order.status}
                    balance={order.balance}
                    boxes={availableBoxes}
                  />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron pedidos en este estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
