import prisma from '@/lib/prisma';

export default async function CajasPage() {
  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  
  const boxes = tenant ? await prisma.box.findMany({
    where: { tenantId: tenant.id },
    include: {
      orders: {
        include: {
          client: true,
          products: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  }) : [];

  const totalCajas = boxes.length;
  const inTransit = boxes.filter(b => b.status === 'IN_TRANSIT').length;
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
            <option>PENDING</option>
            <option>IN_TRANSIT</option>
            <option>DELIVERED</option>
          </select>
        </div>
        <div className="input-container" style={{ flex: 1, minWidth: '200px' }}>
          <label>Buscar Código</label>
          <input type="text" className="input-field" placeholder="Código de caja..." />
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', borderLeft: '4px solid var(--accent-color)' }}>
        <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>ℹ️</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Mostrando todas las cajas. <strong>{totalCajas} caja(s) total(es)</strong>
        </span>
      </div>

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
          <div className="stat-title" style={{ color: '#10b981' }}>Entregadas</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{delivered}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#3b82f6' }}>Peso Total</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalWeight.toFixed(2)} lbs</div>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID CAJA</th>
              <th>TAMAÑO</th>
              <th>ESTADO</th>
              <th>PRODUCTOS</th>
              <th>PESO TOTAL</th>
              <th>CLIENTES</th>
              <th>FECHA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr key={box.id}>
                <td><strong>{box.internalId}</strong></td>
                <td>{box.size}</td>
                <td>
                  <span className={`badge ${
                    box.status === 'DELIVERED' ? 'badge-success' : 
                    box.status === 'IN_TRANSIT' ? 'badge-warning' : 'badge-secondary'
                  }`}>
                    {box.status === 'DELIVERED' ? 'Entregado' : 
                     box.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Pendiente'}
                  </span>
                </td>
                <td>{box.orders.reduce((sum, o) => sum + o.products.length, 0)}</td>
                <td>{box.totalWeight?.toFixed(2) || '0.00'} lbs</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {Array.from(new Set(box.orders.map(o => o.client.name))).slice(0, 2).map((name, i) => (
                      <span key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        • {name}
                      </span>
                    ))}
                    {new Set(box.orders.map(o => o.client.name)).size > 2 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>
                        + {new Set(box.orders.map(o => o.client.name)).size - 2} más
                      </span>
                    )}
                  </div>
                </td>
                <td>{new Date(box.createdAt).toLocaleDateString()}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Ver Detalle">📄</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Editar">✏️</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }} title="Eliminar">🗑️</button>
                </td>
              </tr>
            ))}
            {boxes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron cajas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

