export default function PedidosPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">Lista de pedidos con información de asignación de productos a cajas.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn">
            + Nuevo Pedido
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="input-container" style={{ flex: 1, minWidth: '200px' }}>
          <label>Buscar Cliente</label>
          <input type="text" className="input-field" placeholder="Nombre del cliente..." />
        </div>
        <div className="input-container">
          <label>Fecha Inicial</label>
          <input type="date" className="input-field" />
        </div>
        <div className="input-container">
          <label>Fecha Final</label>
          <input type="date" className="input-field" />
        </div>
        <div className="input-container">
          <label>Estado</label>
          <select className="input-field">
            <option>Todos los Estados</option>
            <option>En Tránsito</option>
            <option>Entregado</option>
          </select>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>PEDIDO / PAÍS</th>
              <th>FECHA ⬇</th>
              <th>ESTADO</th>
              <th>PRODUCTOS</th>
              <th>CAJAS</th>
              <th>TOTAL / BALANCE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Maria Cielo Duran</strong><br/>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00351</span>
              </td>
              <td>ID Pedido: 935 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
              <td>24/04/2026 22:06</td>
              <td>
                <select className="input-field" style={{ padding: '6px' }} defaultValue="transit">
                  <option value="transit">En Tránsito</option>
                  <option value="delivered">Entregado</option>
                </select>
              </td>
              <td>2 / 2 prod.</td>
              <td>0 caja(s)</td>
              <td>
                <strong>$8.50</strong><br/>
                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Bal: $0.00</span>
              </td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📦</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>💳</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Astrid Bravo</strong><br/>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00313</span>
              </td>
              <td>ID Pedido: 934 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
              <td>24/04/2026 22:02</td>
              <td>
                <select className="input-field" style={{ padding: '6px' }} defaultValue="transit">
                  <option value="transit">En Tránsito</option>
                  <option value="delivered">Entregado</option>
                </select>
              </td>
              <td>3 / 3 prod.</td>
              <td>0 caja(s)</td>
              <td>
                <strong>$17.00</strong><br/>
                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Bal: $0.00</span>
              </td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📦</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>💳</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>✏️</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}>🗑️</button>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Sebastian Reinoso</strong><br/>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EC00164</span>
              </td>
              <td>ID Pedido: 933 <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: EC</span></td>
              <td>24/04/2026 22:01</td>
              <td>
                <select className="input-field" style={{ padding: '6px' }} defaultValue="transit">
                  <option value="transit">En Tránsito</option>
                  <option value="delivered">Entregado</option>
                </select>
              </td>
              <td>1 / 1 prod.</td>
              <td>0 caja(s)</td>
              <td>
                <strong>$4.25</strong><br/>
                <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Bal: $4.25</span>
              </td>
              <td style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>📦</button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }}>💳</button>
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
