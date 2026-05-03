import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import EditClientForm from './EditClientForm';
import NewAdjustmentModal from './NewAdjustmentModal';
import { deleteAdjustment } from '../../actions/adjustments';

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
      adjustments: {
        orderBy: { date: 'desc' },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const totalSpent = client.orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = client.orders.length;

  const orderBalance = client.orders.reduce((sum, o) => sum + o.balance, 0);
  const cargos = client.adjustments.filter(a => a.type === 'CARGO').reduce((sum, a) => sum + a.amount, 0);
  const creditos = client.adjustments.filter(a => a.type === 'CREDITO').reduce((sum, a) => sum + a.amount, 0);
  const netBalance = orderBalance + cargos - creditos;

  async function handleDelete(formData: FormData) {
    'use server';
    const adjId = formData.get('adjId') as string;
    await deleteAdjustment(adjId, id);
  }

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
        <Link href={`/clientes/${id}/estado-de-cuenta`} className="btn btn-secondary">
          📋 Ver Estado de Cuenta
        </Link>
      </header>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '32px' }}>
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
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Saldo Global</div>
          <div className="stat-value" style={{ fontSize: '1.8rem', color: netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : 'var(--text-primary)' }}>
            ${Math.abs(netBalance).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: '4px', fontWeight: 600, color: netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : 'var(--text-muted)' }}>
            {netBalance > 0 ? 'Cliente debe' : netBalance < 0 ? 'ShopUSA debe' : '✓ Al día'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        <section>
          <EditClientForm client={client} />
        </section>

        {/* Cargos y Créditos */}
        <section>
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Cargos y Créditos</h2>
              <NewAdjustmentModal clientId={id} />
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>TIPO</th>
                    <th>DESCRIPCIÓN</th>
                    <th>MONTO</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {client.adjustments.map((adj) => (
                    <tr key={adj.id}>
                      <td>{new Date(adj.date).toLocaleDateString('es-ES')}</td>
                      <td>
                        <span className={`badge ${adj.type === 'CARGO' ? 'badge-warning' : 'badge-success'}`}>
                          {adj.type === 'CARGO' ? '🔴 Cargo' : '🟢 Crédito'}
                        </span>
                      </td>
                      <td>{adj.description}</td>
                      <td style={{ fontWeight: 700, color: adj.type === 'CARGO' ? '#ef4444' : '#10b981' }}>
                        {adj.type === 'CARGO' ? '+' : '-'}${adj.amount.toFixed(2)}
                      </td>
                      <td>
                        <form action={handleDelete}>
                          <input type="hidden" name="adjId" value={adj.id} />
                          <button
                            type="submit"
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {client.adjustments.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No hay cargos o créditos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Order history */}
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
                        <Link href={`/pedidos/${order.id}`} className="btn btn-secondary" style={{ padding: '6px 10px' }}>Ver</Link>
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
