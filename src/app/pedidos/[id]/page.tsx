import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { statusLabel, statusBadgeClass } from '@/lib/orderStatus';
import OrderStatusChanger from './OrderStatusChanger';
import RegisterPaymentButton from './RegisterPaymentButton';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      products: true,
      box: true,
    },
  });

  if (!order) notFound();

  const amountPaid = order.totalAmount - order.balance;
  const ref = `#${order.id.slice(-6).toUpperCase()}`;
  const baseAmount = order.totalAmount - order.taxAmount - order.serviceFeeAmount;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/pedidos" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            &larr; Pedidos
          </Link>
          <div>
            <h1 className="page-title">Pedido {ref}</h1>
            <p className="page-subtitle">
              <Link href={`/clientes/${order.client.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>
                {order.client.name}
              </Link>{' '}
              — Código: <strong>{order.client.code}</strong>
            </p>
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(order.status)}`} style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
          {statusLabel(order.status)}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cambiar estado
          </div>
          <OrderStatusChanger orderId={order.id} currentStatus={order.status} />
        </div>
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '8px', minWidth: '220px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pagos
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Balance: <strong style={{ color: order.balance > 0 ? '#ef4444' : '#10b981' }}>${order.balance.toFixed(2)}</strong>
          </div>
          <RegisterPaymentButton orderId={order.id} balance={order.balance} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Fecha</div>
          <div className="stat-value" style={{ fontSize: '1.3rem' }}>
            {new Date(order.orderDate).toLocaleDateString('es-ES')}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Subtotal Productos</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>${baseAmount.toFixed(2)}</div>
        </div>
        {order.taxAmount > 0 && (
          <div className="glass-panel stat-card" style={{ padding: '20px' }}>
            <div className="stat-title">Impuesto (6.5%)</div>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: '#ef4444' }}>${order.taxAmount.toFixed(2)}</div>
          </div>
        )}
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Service Fee ({order.serviceFeePercent}%)</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#f59e0b' }}>${order.serviceFeeAmount.toFixed(2)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Total del Pedido</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>${order.totalAmount.toFixed(2)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Pagado</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#10b981' }}>${amountPaid.toFixed(2)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Balance Pendiente</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: order.balance > 0 ? '#ef4444' : '#10b981' }}>
            ${order.balance.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Caja Asignada</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', color: order.box ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            {order.box ? `📦 ${order.box.internalId}` : 'Sin caja'}
          </div>
        </div>
      </div>

      {/* Products table */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Productos / Ítems ({order.products.length})</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>NOMBRE</th>
                <th>PESO (lbs)</th>
                <th>COMPRADO POR</th>
                <th style={{ textAlign: 'right' }}>VALOR COMPRA</th>
                <th style={{ textAlign: 'right' }}>COSTO ENVÍO</th>
                <th style={{ textAlign: 'right' }}>PREPAGO</th>
                <th style={{ textAlign: 'right' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {order.products.map((p, i) => {
                const subtotal = p.shippingCost + (p.purchasedBy === 'SHOPUSA' ? (p.purchaseValue ?? 0) : 0);
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.weight.toFixed(2)} lbs</td>
                    <td>
                      <span className={`badge ${p.purchasedBy === 'SHOPUSA' ? 'badge-warning' : 'badge-secondary'}`}>
                        {p.purchasedBy === 'SHOPUSA' ? '🏪 ShopUSA' : '👤 Cliente'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.purchasedBy === 'SHOPUSA' && p.purchaseValue != null
                        ? `$${p.purchaseValue.toFixed(2)}`
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>${p.shippingCost.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                      {p.prepaidAmount > 0 ? `$${p.prepaidAmount.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
              {order.products.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Sin productos registrados.
                  </td>
                </tr>
              )}
            </tbody>
            {order.products.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(128,128,128,0.2)' }}>
                  <td colSpan={6} style={{ fontWeight: 700, padding: '14px 16px' }}>TOTALES</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', padding: '14px 16px' }}>
                    ${order.products.reduce((s, p) => s + p.prepaidAmount, 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', padding: '14px 16px' }}>
                    ${order.totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
