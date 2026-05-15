import Link from 'next/link';
import prisma from '@/lib/prisma';
import BoxStatusActions from './BoxStatusActions';
import NewBoxModal from './NewBoxModal';
import { normalizeOrderStatus } from '@/lib/orderStatus';

export default async function CajasPage() {
  const tenant = await prisma.tenant.findFirst();

  const boxes = tenant ? await prisma.box.findMany({
    where: { tenantId: tenant.id },
    include: {
      orders: {
        include: {
          client: true,
          products: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  }) : [];

  const totalCajas = boxes.length;
  const inTransit = boxes.filter(b => b.status === 'IN_TRANSIT' && !b.orders.some(o => normalizeOrderStatus(o.status) === 'ARRIVED')).length;
  const arrived = boxes.filter(b => b.status !== 'DELIVERED' && b.orders.some(o => normalizeOrderStatus(o.status) === 'ARRIVED')).length;
  const delivered = boxes.filter(b => b.status === 'DELIVERED').length;
  const totalWeight = boxes.reduce((sum, b) => sum + (b.totalWeight || 0), 0);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Cajas</h1>
          <p className="page-subtitle">Lista de todas las cajas con información de contenido y estado.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <NewBoxModal />
        </div>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Total Cajas</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalCajas}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#f59e0b' }}>En Tránsito</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{inTransit}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#3b82f6' }}>Llegó al país</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{arrived}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#10b981' }}>Entregadas</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{delivered}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Peso Total</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalWeight.toFixed(2)} lbs</div>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID CAJA</th>
              <th>TAMAÑO / DESTINO</th>
              <th>ESTADO</th>
              <th>CLIENTES Y PRODUCTOS</th>
              <th>PEDIDOS</th>
              <th>PESO</th>
              <th>FECHA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => {
              const totalProducts = box.orders.reduce((s, o) => s + o.products.length, 0);
              const allDelivered = box.orders.length > 0 && box.orders.every(o => normalizeOrderStatus(o.status) === 'DELIVERED');
              const anyArrived = box.orders.some(o => normalizeOrderStatus(o.status) === 'ARRIVED');
              const uniqueClients = Array.from(new Map(box.orders.map(o => [o.client.id, o.client])).values());

              const uiStatus = box.status === 'DELIVERED' ? 'DELIVERED' : anyArrived ? 'ARRIVED' : 'IN_TRANSIT';
              const statusLabel = uiStatus === 'DELIVERED' ? 'Entregada' : uiStatus === 'ARRIVED' ? 'Llegó al país' : 'En Tránsito';
              const statusBadge = uiStatus === 'DELIVERED' ? 'badge-success' : uiStatus === 'ARRIVED' ? 'badge-info' : 'badge-warning';

              return (
                <tr key={box.id}>
                  <td>
                    <Link href={`/cajas/${box.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 700 }}>
                      {box.internalId}
                    </Link>
                  </td>
                  <td>
                    {box.size}<br/>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>→ {box.country}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge}`}>{statusLabel}</span>
                  </td>
                  <td>
                    {uniqueClients.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin pedidos</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '280px' }}>
                        {uniqueClients.slice(0, 3).map((c) => {
                          const clientOrders = box.orders.filter(o => o.clientId === c.id);
                          const productCount = clientOrders.reduce((s, o) => s + o.products.length, 0);
                          const productPreview = clientOrders
                            .flatMap(o => o.products.map(p => p.name))
                            .slice(0, 2)
                            .join(', ');
                          const more = productCount - 2;
                          return (
                            <div key={c.id} style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>
                              <strong>{c.name}</strong>
                              <span style={{ color: 'var(--text-muted)' }}> ({productCount} prod.)</span>
                              {productPreview && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {productPreview}{more > 0 ? ` +${more} más` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {uniqueClients.length > 3 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                            + {uniqueClients.length - 3} cliente(s) más
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{box.orders.length}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{(box.totalWeight ?? 0).toFixed(2)} lbs</td>
                  <td>{new Date(box.createdAt).toLocaleDateString('es-ES')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                      <Link href={`/cajas/${box.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', textAlign: 'center' }}>
                        📄 Ver
                      </Link>
                      <BoxStatusActions
                        boxId={box.id}
                        boxStatus={box.status}
                        hasOrders={box.orders.length > 0}
                        allDelivered={allDelivered}
                        anyArrived={anyArrived}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {boxes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron cajas. Crea una nueva para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
