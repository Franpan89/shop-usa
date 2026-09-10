import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { statusLabel, statusBadgeClass } from '@/lib/orderStatus';

export const dynamic = 'force-dynamic';

export default async function PortalPedidosPage() {
  const client = await requirePortalClient();

  const orders = await prisma.order.findMany({
    where: { clientId: client.id },
    include: { products: true },
    orderBy: { orderDate: 'desc' },
  });

  return (
    <div style={{ padding: '32px' }}>
      <h1 className="page-title" style={{ marginBottom: '4px' }}>Mis Pedidos</h1>
      <p className="page-subtitle" style={{ marginBottom: '24px' }}>Hola {client.name}, aquí está el estado de tus envíos.</p>

      {orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Todavía no tienes pedidos registrados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map((order) => (
            <div key={order.id} className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700 }}>Pedido #{order.id.slice(-6).toUpperCase()}</span>
                  <span className={`badge ${statusBadgeClass(order.status)}`}>{statusLabel(order.status)}</span>
                  {order.receivedStatus === 'NOVEDAD' && (
                    <span className="badge badge-danger" title={order.receivedNote ?? undefined}>⚠️ Novedad</span>
                  )}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {new Date(order.orderDate).toLocaleDateString('es-ES')}
                </span>
              </div>

              {order.receivedStatus === 'NOVEDAD' && order.receivedNote && (
                <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
                  {order.receivedNote}
                </div>
              )}

              {order.products.length > 0 && (
                <div className="table-container">
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>PRODUCTO</th>
                        <th>PESO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td>{p.weight.toFixed(2)} lbs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total: </span>
                  <strong>${order.totalAmount.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Balance: </span>
                  <strong style={{ color: order.balance > 0 ? '#ef4444' : '#10b981' }}>${order.balance.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
