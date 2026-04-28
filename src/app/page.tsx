import Link from 'next/link';

export default function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monitoreo general de ShopUSA SaaS</p>
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
          <div className="stat-value">71</div>
          <div className="stat-desc">0 entregados</div>
          <Link href="/pedidos" style={{ color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none', marginTop: '16px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Ver todos los pedidos <span>&rarr;</span>
          </Link>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
            📦
          </div>
          <div className="stat-title">Cajas del Período</div>
          <div className="stat-value">0</div>
          <div className="stat-desc">en tránsito hacia Ecuador/Panamá</div>
          <Link href="/cajas" style={{ color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none', marginTop: '16px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Ver todas las cajas <span>&rarr;</span>
          </Link>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
            $
          </div>
          <div className="stat-title">Ingresos Totales</div>
          <div className="stat-value">$4,771.87</div>
          <div className="stat-desc">Pedidos + Ventas Directas</div>
          <div style={{ color: '#10b981', fontWeight: 600, marginTop: '16px', fontSize: '1rem', cursor: 'pointer' }}>Ver detalles financieros</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>
            📈
          </div>
          <div className="stat-title">Utilidad del Período</div>
          <div className="stat-value text-success">$3,252.71</div>
          <div className="stat-desc">Gastos documentados: $1,519.16</div>
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 700 }}>Actividad Reciente (Pedidos en Tránsito)</h3>
        <div className="glass-panel table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>PEDIDO / PAÍS</th>
                <th>FECHA</th>
                <th>ESTADO</th>
                <th>PRODUCTOS</th>
                <th>TOTAL</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong style={{ fontSize: '1.05rem' }}>Maria Cielo Duran</strong><br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00351</span>
                </td>
                <td>ID: 935 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
                <td>24/04/2026 22:06</td>
                <td><span className="badge badge-warning">En Tránsito</span></td>
                <td>2 / 2 prod.</td>
                <td>
                  <strong>$8.50</strong><br/>
                  <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Bal: $0.00</span>
                </td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>Ver</button>
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ fontSize: '1.05rem' }}>Astrid Bravo</strong><br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00313</span>
                </td>
                <td>ID: 934 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
                <td>24/04/2026 22:02</td>
                <td><span className="badge badge-warning">En Tránsito</span></td>
                <td>3 / 3 prod.</td>
                <td>
                  <strong>$17.00</strong><br/>
                  <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Bal: $0.00</span>
                </td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>Ver</button>
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ fontSize: '1.05rem' }}>Sebastian Reinoso</strong><br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00164</span>
                </td>
                <td>ID: 933 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
                <td>24/04/2026 22:01</td>
                <td><span className="badge badge-warning">En Tránsito</span></td>
                <td>1 / 1 prod.</td>
                <td>
                  <strong>$4.25</strong><br/>
                  <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Bal: $4.25</span>
                </td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>Ver</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
