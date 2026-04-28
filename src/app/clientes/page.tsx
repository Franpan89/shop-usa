export default function ClientesPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Lista de todos los clientes incluyendo su información de contacto y resumen de pedidos.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn">
            + Nuevo Cliente
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="input-container" style={{ flex: 1, minWidth: '200px' }}>
          <label>Buscar Cliente</label>
          <input type="text" className="input-field" placeholder="Nombre del cliente..." />
        </div>
        <div className="input-container">
          <label>Estado de Pedidos</label>
          <select className="input-field">
            <option>Con Pedidos</option>
            <option>Sin Pedidos</option>
            <option>Todos</option>
          </select>
        </div>
        <div className="input-container">
          <label>País</label>
          <select className="input-field">
            <option>Todos los Países</option>
            <option>Ecuador</option>
            <option>Panamá</option>
          </select>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Buscar
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', borderLeft: '4px solid var(--accent-color)' }}>
        <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>ℹ️</span>
        <span style={{ color: 'var(--text-muted)' }}>Mostrando solo clientes que tienen al menos un pedido registrado. <strong>278 cliente(s) encontrado(s).</strong></span>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>NOMBRE</th>
              <th>PAÍS</th>
              <th>CIUDAD</th>
              <th>TELÉFONO</th>
              <th>PEDIDOS</th>
              <th>TOTAL</th>
              <th>PAGADO</th>
              <th>BALANCE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EC00352</td>
              <td><strong>Eli Alvarado</strong></td>
              <td>Ecuador</td>
              <td>Cuenca</td>
              <td>+593-95-909-8703</td>
              <td>1</td>
              <td>$33.90</td>
              <td style={{ color: '#10b981', fontWeight: 600 }}>$33.90</td>
              <td style={{ color: '#10b981', fontWeight: 600 }}>$0.00</td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📄</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📦</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td>EC00349</td>
              <td><strong>Juanita Valdivieso</strong></td>
              <td>Ecuador</td>
              <td>Cuenca</td>
              <td>+593 99 304 2410</td>
              <td>2</td>
              <td>$96.93</td>
              <td style={{ color: '#10b981', fontWeight: 600 }}>$91.97</td>
              <td style={{ color: '#ef4444', fontWeight: 600 }}>$4.96</td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📄</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📦</button>
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
