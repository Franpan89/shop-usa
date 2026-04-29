import prisma from '@/lib/prisma';

export default async function GastosPage() {
  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  
  const expenses = tenant ? await prisma.expense.findMany({
    where: { tenantId: tenant.id },
    orderBy: { expenseDate: 'desc' }
  }) : [];

  const orders = tenant ? await prisma.order.findMany({
    where: { tenantId: tenant.id },
  }) : [];

  const totalIncome = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.originalAmount ?? 0), 0);
  const utility = totalIncome - totalExpenses;

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
          <button className="btn" style={{ height: '42px', padding: '0 24px' }}>
            🔍 Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Ingresos Totales</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#10b981' }}>${totalIncome.toFixed(2)}</div>
          <div className="stat-desc">Basado en pedidos registrados</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#ef4444' }}>Gastos Totales</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#ef4444' }}>-${totalExpenses.toFixed(2)}</div>
          <div className="stat-desc">Todos los egresos registrados</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title" style={{ color: '#10b981' }}>Utilidad</div>
          <div className="stat-value" style={{ fontSize: '2rem', color: '#10b981' }}>${utility.toFixed(2)}</div>
          <div className="stat-desc">{utility >= 0 ? 'Ganancia Neta' : 'Pérdida'}</div>
        </div>
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
                <td>{new Date(expense.expenseDate).toLocaleDateString()}</td>
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
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron gastos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

