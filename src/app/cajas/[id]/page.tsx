import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import BoxStatusActions from '../BoxStatusActions';
import { normalizeOrderStatus, statusBadgeClass, statusLabel } from '@/lib/orderStatus';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BoxDetailPage({ params }: Props) {
  const { id } = await params;

  const box = await prisma.box.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          client: true,
          products: true,
        },
        orderBy: { orderDate: 'asc' },
      },
    },
  });

  if (!box) notFound();

  // Group orders by client
  const ordersByClient = new Map<string, { client: typeof box.orders[number]['client']; orders: typeof box.orders }>();
  for (const o of box.orders) {
    if (!ordersByClient.has(o.clientId)) {
      ordersByClient.set(o.clientId, { client: o.client, orders: [] });
    }
    ordersByClient.get(o.clientId)!.orders.push(o);
  }

  const totalProducts = box.orders.reduce((s, o) => s + o.products.length, 0);
  const totalValue = box.orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalBalance = box.orders.reduce((s, o) => s + o.balance, 0);
  const allDelivered = box.orders.length > 0 && box.orders.every(o => normalizeOrderStatus(o.status) === 'DELIVERED');
  const anyArrived = box.orders.some(o => normalizeOrderStatus(o.status) === 'ARRIVED');

  const boxStatusLabel = box.status === 'DELIVERED' ? 'Entregada' : anyArrived ? 'Llegó al país' : 'En Tránsito';
  const boxStatusBadge = box.status === 'DELIVERED' ? 'badge-success' : anyArrived ? 'badge-info' : 'badge-warning';

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/cajas" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            &larr; Cajas
          </Link>
          <div>
            <h1 className="page-title">Caja {box.internalId}</h1>
            <p className="page-subtitle">
              {box.size} · {box.country} · Creada {new Date(box.createdAt).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
        <span className={`badge ${boxStatusBadge}`} style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
          {boxStatusLabel}
        </span>
      </header>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Pedidos</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{box.orders.length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Clientes</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{ordersByClient.size}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Productos</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalProducts}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Peso Total</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{(box.totalWeight ?? 0).toFixed(2)} lbs</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Valor Total</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>${totalValue.toFixed(2)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Balance Pendiente</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: totalBalance > 0 ? '#ef4444' : '#10b981' }}>
            ${totalBalance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Acciones de caja
        </div>
        <BoxStatusActions
          boxId={box.id}
          boxStatus={box.status}
          hasOrders={box.orders.length > 0}
          allDelivered={allDelivered}
          anyArrived={anyArrived}
        />
      </div>

      {ordersByClient.size === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Esta caja aún no tiene pedidos asignados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Array.from(ordersByClient.values()).map(({ client, orders }) => {
            const clientWeight = orders.reduce((s, o) => s + o.products.reduce((ss, p) => ss + p.weight, 0), 0);
            const clientTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
            const clientBalance = orders.reduce((s, o) => s + o.balance, 0);

            return (
              <div key={client.id} className="glass-panel" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <Link
                      href={`/clientes/${client.id}`}
                      style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-color)', textDecoration: 'none' }}
                    >
                      👤 {client.name}
                    </Link>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {client.code} · {client.city}, {client.country} · {client.phone}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Peso</div>
                      <strong>{clientWeight.toFixed(2)} lbs</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Total</div>
                      <strong>${clientTotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Balance</div>
                      <strong style={{ color: clientBalance > 0 ? '#ef4444' : '#10b981' }}>
                        ${clientBalance.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>

                {orders.map((order) => (
                  <div key={order.id} style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(128,128,128,0.05)', border: '1px solid rgba(128,128,128,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
                      <Link
                        href={`/pedidos/${order.id}`}
                        style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        Pedido #{order.id.slice(-6).toUpperCase()}
                      </Link>
                      <span className={`badge ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(order.orderDate).toLocaleDateString('es-ES')}
                      </span>
                    </div>

                    {order.products.length > 0 ? (
                      <div className="table-container">
                        <table className="data-table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>PRODUCTO</th>
                              <th>PESO</th>
                              <th>COMPRADO POR</th>
                              <th style={{ textAlign: 'right' }}>VALOR</th>
                              <th style={{ textAlign: 'right' }}>ENVÍO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.products.map((p) => (
                              <tr key={p.id}>
                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                <td>{p.weight.toFixed(2)} lbs</td>
                                <td>
                                  <span className={`badge ${p.purchasedBy === 'SHOPUSA' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>
                                    {p.purchasedBy === 'SHOPUSA' ? '🏪 ShopUSA' : '👤 Cliente'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {p.purchaseValue != null ? `$${p.purchaseValue.toFixed(2)}` : '—'}
                                </td>
                                <td style={{ textAlign: 'right' }}>${p.shippingCost.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Sin productos registrados.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
