import prisma from '@/lib/prisma';

export default async function ContabilidadPage() {
  const tenant = await prisma.tenant.findFirst();

  const [expenses, orders] = await Promise.all([
    tenant ? prisma.expense.findMany({
      where: { tenantId: tenant.id },
      orderBy: { expenseDate: 'desc' }
    }) : Promise.resolve([]),
    tenant ? prisma.order.findMany({
      where: { tenantId: tenant.id },
      include: { client: true }
    }) : Promise.resolve([]),
  ]);

  // --- Financial calculations ---
  const totalVentas = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  const totalCobrado = totalVentas - orders.reduce((sum, o) => sum + (o.balance ?? 0), 0);
  const totalPorCobrar = orders.reduce((sum, o) => sum + (o.balance ?? 0), 0);
  const totalGastos = expenses.reduce((sum, e) => sum + (e.originalAmount ?? 0), 0);
  const utilidad = totalVentas - totalGastos;
  const utilidadNeta = totalCobrado - totalGastos;

  const kpiColor = (val: number, inverse = false) => {
    if (inverse) return val > 0 ? '#ef4444' : '#10b981';
    return val >= 0 ? '#10b981' : '#ef4444';
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Contabilidad</h1>
          <p className="page-subtitle">Resumen financiero: ventas, cobros, gastos y utilidad del negocio.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn">+ Nuevo Gasto</button>
          <button className="btn btn-secondary">📄 Reporte PDF</button>
        </div>
      </header>

      {/* --- KPI Cards Row 1: Sales --- */}
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ margin: '0 0 14px 4px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Ventas
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>💰</div>
            <div className="stat-title">Total Ventas</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: '#10b981' }}>${totalVentas.toFixed(2)}</div>
            <div className="stat-desc">{orders.length} pedido(s) registrado(s)</div>
          </div>

          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>✅</div>
            <div className="stat-title">Cobrado</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: '#10b981' }}>${totalCobrado.toFixed(2)}</div>
            <div className="stat-desc">Pagos recibidos de clientes</div>
          </div>

          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>⏳</div>
            <div className="stat-title">Por Cobrar</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: totalPorCobrar > 0 ? '#f59e0b' : '#10b981' }}>${totalPorCobrar.toFixed(2)}</div>
            <div className="stat-desc">Saldo pendiente de clientes</div>
          </div>
        </div>
      </div>

      {/* --- KPI Cards Row 2: Profitability --- */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 14px 4px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Rentabilidad
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>💸</div>
            <div className="stat-title" style={{ color: '#ef4444' }}>Total Gastos</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: '#ef4444' }}>-${totalGastos.toFixed(2)}</div>
            <div className="stat-desc">{expenses.length} egreso(s) registrado(s)</div>
          </div>

          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>📈</div>
            <div className="stat-title">Utilidad Bruta</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: kpiColor(utilidad) }}>${utilidad.toFixed(2)}</div>
            <div className="stat-desc">Ventas − Gastos</div>
          </div>

          <div className="glass-panel stat-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🏦</div>
            <div className="stat-title">Utilidad Neta</div>
            <div className="stat-value" style={{ fontSize: '1.9rem', color: kpiColor(utilidadNeta) }}>${utilidadNeta.toFixed(2)}</div>
            <div className="stat-desc">Cobrado − Gastos</div>
          </div>
        </div>
      </div>

      {/* --- Filters --- */}
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
          <label>Categoría</label>
          <select className="input-field">
            <option>Todas las Categorías</option>
            <option>LOGISTICS</option>
            <option>SUPPLIES</option>
            <option>SALES</option>
            <option>OTHER</option>
          </select>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>🔍 Filtrar</button>
        </div>
      </div>

      {/* --- Expenses Table --- */}
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ margin: '0 0 14px 4px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Registro de Gastos / Egresos
        </h3>
      </div>
      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>CATEGORÍA</th>
              <th>DESCRIPCIÓN</th>
              <th>PAÍS</th>
              <th>VALOR ORIGINAL</th>
              <th>VALOR AJUSTADO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{new Date(expense.expenseDate).toLocaleDateString('es-ES')}</td>
                <td>
                  <span className={`badge ${
                    expense.category === 'LOGISTICS' ? 'badge-warning' :
                    expense.category === 'SUPPLIES' ? 'badge-info' : 'badge-success'
                  }`}>
                    {expense.category}
                  </span>
                </td>
                <td>{expense.description}</td>
                <td>{expense.country || 'N/A'}</td>
                <td><strong style={{ color: '#ef4444' }}>${(expense.originalAmount ?? 0).toFixed(2)}</strong></td>
                <td><strong style={{ color: '#ef4444' }}>${(expense.adjustedAmount ?? expense.originalAmount ?? 0).toFixed(2)}</strong></td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Editar">✏️</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }} title="Eliminar">🗑️</button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron gastos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Por Cobrar Table --- */}
      {totalPorCobrar > 0 && (
        <>
          <div style={{ margin: '32px 0 12px 4px' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              ⏳ Pedidos con Saldo Pendiente
            </h3>
          </div>
          <div className="glass-panel table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th>TOTAL PEDIDO</th>
                  <th>COBRADO</th>
                  <th>POR COBRAR</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter(o => (o.balance ?? 0) > 0)
                  .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
                  .map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.client.name}</strong><br/>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.client.code}</span>
                      </td>
                      <td>{new Date(order.orderDate).toLocaleDateString('es-ES')}</td>
                      <td>
                        <span className={`badge ${order.status === 'DELIVERED' ? 'badge-success' : order.status === 'IN_TRANSIT' ? 'badge-warning' : 'badge-secondary'}`}>
                          {order.status === 'DELIVERED' ? 'Entregado' : order.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Pendiente'}
                        </span>
                      </td>
                      <td><strong>${(order.totalAmount ?? 0).toFixed(2)}</strong></td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>${((order.totalAmount ?? 0) - (order.balance ?? 0)).toFixed(2)}</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>${(order.balance ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
