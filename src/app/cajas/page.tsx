export default function CajasPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Cajas</h1>
          <p className="page-subtitle">Lista de todas las cajas con información de contenido y estado.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn">
            + Nueva Caja
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="input-container">
          <label>Fecha Inicial</label>
          <input type="date" className="input-field" />
        </div>
        <div className="input-container">
          <label>Fecha Final</label>
          <input type="date" className="input-field" />
        </div>
        <div className="input-container">
          <label>Estado de Caja</label>
          <select className="input-field">
            <option>Todos los Estados</option>
            <option>Entregado</option>
            <option>En Tránsito</option>
          </select>
        </div>
        <div className="input-container" style={{ flex: 1, minWidth: '200px' }}>
          <label>Buscar Cliente</label>
          <input type="text" className="input-field" placeholder="Nombre del cliente..." />
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

      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', borderLeft: '4px solid var(--accent-color)' }}>
        <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>ℹ️</span>
        <span style={{ color: 'var(--text-muted)' }}>Mostrando todas las cajas. Use los filtros arriba para refinar los resultados. <strong>153 caja(s) total(es)</strong></span>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Total Cajas</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>153</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#f59e0b' }}>En Tránsito</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>0</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#10b981' }}>Entregadas</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>153</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#3b82f6' }}>Peso Total</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>1,335.0 lbs</div>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID CAJA</th>
              <th>TAMAÑO</th>
              <th>ESTADO</th>
              <th>PAÍS</th>
              <th>PRODUCTOS</th>
              <th>PESO TOTAL</th>
              <th>CLIENTES</th>
              <th>FECHA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>#158</strong></td>
              <td>Small</td>
              <td><span className="badge badge-success">Entregado</span></td>
              <td>Ecuador</td>
              <td>13</td>
              <td>7.74 lbs</td>
              <td><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00015 - Maria Jose ...</span></td>
              <td>12/03/2026</td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📄</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td><strong>#157</strong></td>
              <td>Small</td>
              <td><span className="badge badge-success">Entregado</span></td>
              <td>Ecuador</td>
              <td>14</td>
              <td>8.46 lbs</td>
              <td><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00015 - Maria Jose ...</span></td>
              <td>12/03/2026</td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📄</button>
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
