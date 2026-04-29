import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import EditClientForm from './EditClientForm';

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        include: { products: true },
        orderBy: { orderDate: 'desc' },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const totalSpent = client.orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = client.orders.length;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/clientes" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            &larr; Volver
          </Link>
          <div>
            <h1 className="page-title">{client.name}</h1>
            <p className="page-subtitle">Código: <strong>{client.code}</strong> | Cliente desde: {new Date(client.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '32px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Total Compras</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>${totalSpent.toFixed(2)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Pedidos Totales</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalOrders}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Ubicación</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{client.city}, {client.country}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        <section>
          <EditClientForm client={client} />
        </section>

        <section>
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>Historial de Compras / Envíos</h2>
            
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>ESTADO</th>
                    <th>PRODUCTOS</th>
                    <th>TOTAL</th>
                    <th>BALANCE</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {client.orders.map((order) => (
                    <tr key={order.id}>
                      <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${order.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}`}>
                          {order.status === 'DELIVERED' ? 'Entregado' : order.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Pendiente'}
                        </span>
                      </td>
                      <td>{order.products.length}</td>
                      <td><strong>${order.totalAmount.toFixed(2)}</strong></td>
                      <td style={{ color: order.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        ${order.balance.toFixed(2)}
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }}>Ver</button>
                      </td>
                    </tr>
                  ))}
                  {client.orders.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        Este cliente aún no tiene pedidos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
