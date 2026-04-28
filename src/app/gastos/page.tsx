export default function GastosPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">Gestión de gastos del negocio con análisis de rentabilidad.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn">
            + Nuevo Gasto
          </button>
          <button className="btn btn-secondary">
            Reporte PDF
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="input-container">
          <label>Fecha Inicial</label>
          <input type="date" className="input-field" defaultValue="2026-04-01" />
        </div>
        <div className="input-container">
          <label>Fecha Final</label>
          <input type="date" className="input-field" defaultValue="2026-04-30" />
        </div>
        <div className="input-container">
          <label>Categoría</label>
          <select className="input-field">
            <option>Todas las Categorías</option>
            <option>Insumos</option>
            <option>Logística</option>
            <option>Ventas</option>
          </select>
        </div>
        <div className="input-container">
          <label>País</label>
          <select className="input-field">
            <option>Todos los Países</option>
            <option>Ecuador</option>
          </select>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card">
          <div className="stat-title">Ingresos Totales</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#10b981' }}>$4,771.87</div>
          <div className="stat-desc">Pedidos: $4,278.37 | Ventas Directas: $493.50</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-title" style={{ color: '#ef4444' }}>Gastos Totales</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#ef4444' }}>-$1,519.16</div>
          <div className="stat-desc">Original: $1,519.16</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-title" style={{ color: '#10b981' }}>Utilidad</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#10b981' }}>$3,252.71</div>
          <div className="stat-desc">Ganancia</div>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>FECHA DEL GASTO</th>
              <th>CATEGORÍA</th>
              <th>DESCRIPCIÓN</th>
              <th>PAÍS</th>
              <th>VALOR ORIGINAL</th>
              <th>VALOR AJUSTADO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>10/04/2026</td>
              <td><span className="badge badge-info">Insumos</span></td>
              <td>Compra de cajas</td>
              <td>Ecuador</td>
              <td>$73.83</td>
              <td><strong style={{ color: '#ef4444' }}>$73.83</strong></td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td>10/04/2026</td>
              <td><span className="badge badge-warning">Logística</span></td>
              <td>Envío 10 de abril</td>
              <td>Ecuador</td>
              <td>$269.45</td>
              <td><strong style={{ color: '#ef4444' }}>$269.45 (100%)</strong></td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td>10/04/2026</td>
              <td><span className="badge badge-success">Ventas</span></td>
              <td>Ventas envío 10 de abril</td>
              <td>Ecuador</td>
              <td>$1,175.88</td>
              <td><strong style={{ color: '#ef4444' }}>$1,175.88</strong></td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
