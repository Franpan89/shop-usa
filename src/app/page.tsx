import Link from 'next/link';
import prisma from '@/lib/prisma';
import { statusLabel, statusBadgeClass } from '@/lib/orderStatus';

export default async function DashboardPage() {
  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  
  if (!tenant) {
    return <div>No tenant found. Please run the seed script.</div>;
  }

  // Fetch summary stats
  const [
    pedidosCount,
    cajasTransitCount,
    cajasDeliveredCount,
    ingresosSum,
    gastosSum,
    recentOrders
  ] = await Promise.all([
    prisma.order.count({ where: { tenantId: tenant.id } }),
    prisma.box.count({ where: { tenantId: tenant.id, status: 'IN_TRANSIT' } }),
    prisma.box.count({ where: { tenantId: tenant.id, status: 'DELIVERED' } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId: tenant.id }
    }),
    prisma.expense.aggregate({
      _sum: { originalAmount: true },
      where: { tenantId: tenant.id }
    }),
    prisma.order.findMany({
      where: { tenantId: tenant.id },
      take: 5,
      orderBy: { orderDate: 'desc' },
      include: { 
        client: true,
        products: true,
      }
    })
  ]);

  const totalIncome = ingresosSum._sum.totalAmount || 0;
  const totalExpenses = gastosSum._sum.originalAmount || 0;
  const utility = totalIncome - totalExpenses;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monitoreo general de ShopUSA SaaS: <strong>{tenant.name}</strong></p>
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="input-container">
            <label>Fecha Inicial</label>
            <input type="date" className="input-field" defaultValue="2026-04-01" />
          </div>
          <div className="input-container">
            <label>Fecha Final</label>
            <input type="date" className="input-field" defaultValue="2026-04-30" />
          </div>
          <button className="btn">
            Filtrar
          </button>
          <button className="btn btn-secondary">
            Reporte PDF
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper">
            🛒
          </div>
          <div className="stat-title">Pedidos del Período</div>
          <div className="stat-value">{pedidosCount}</div>
          <div className="stat-desc">En el sistema actualmente</div>
          <Link href="/pedidos" style={{ color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none', marginTop: '16px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Ver todos los pedidos <span>&rarr;</span>
          </Link>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
            📦
          </div>
          <div className="stat-title">Cajas en Tránsito</div>
          <div className="stat-value">{cajasTransitCount}</div>
          <div className="stat-desc">{cajasDeliveredCount} cajas ya entregadas</div>
          <Link href="/cajas" style={{ color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none', marginTop: '16px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Ver todas las cajas <span>&rarr;</span>
          </Link>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
            $
          </div>
          <div className="stat-title">Ingresos Totales</div>
          <div className="stat-value">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="stat-desc">Pedidos + Ventas Directas</div>
          <div style={{ color: '#10b981', fontWeight: 600, marginTop: '16px', fontSize: '1rem', cursor: 'pointer' }}>Ver detalles financieros</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>
            📈
          </div>
          <div className="stat-title">Utilidad del Período</div>
          <div className={`stat-value ${utility >= 0 ? 'text-success' : 'text-danger'}`}>
            ${utility.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-desc">Gastos documentados: ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 700 }}>Actividad Reciente</h3>
        <div className="glass-panel table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>PAÍS</th>
                <th>FECHA</th>
                <th>ESTADO</th>
                <th>PRODUCTOS</th>
                <th>TOTAL</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong style={{ fontSize: '1.05rem' }}>{order.client.name}</strong><br/>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.client.code}</span>
                  </td>
                  <td>{order.client.country}</td>
                  <td>{new Date(order.orderDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td>{order.products.length} prod.</td>
                  <td>
                    <strong>${order.totalAmount.toFixed(2)}</strong><br/>
                    <span style={{ fontSize: '0.8rem', color: order.balance > 0 ? '#ef4444' : '#10b981' }}>
                      Bal: ${order.balance.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <Link href={`/pedidos/${order.id}`} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.9rem', textDecoration: 'none' }}>Ver</Link>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No hay actividad reciente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

