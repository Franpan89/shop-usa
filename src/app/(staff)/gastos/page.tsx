import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { INVOICE_TYPE } from '@/lib/domain/flow';
import { invoiceCode } from '@/lib/logistics';

export const dynamic = 'force-dynamic';

export default async function ContabilidadPage() {
  await requireStaff();
  const tenant = await prisma.tenant.findFirst();

  const [expenses, invoices, payments] = await Promise.all([
    tenant ? prisma.expense.findMany({
      where: { tenantId: tenant.id },
      orderBy: { expenseDate: 'desc' }
    }) : Promise.resolve([]),
    tenant ? prisma.invoice.findMany({
      where: { tenantId: tenant.id, status: { not: 'CANCELLED' } },
      include: { client: { select: { name: true, code: true } } },
    }) : Promise.resolve([]),
    // Solo dinero real: los créditos/ajustes otorgados no son un cobro.
    tenant ? prisma.payment.findMany({
      where: { tenantId: tenant.id, status: 'APPROVED', kind: 'PAYMENT' },
      select: { amount: true },
    }) : Promise.resolve([]),
  ]);

  // --- Cálculos financieros (sobre facturas y pagos del libro de cuentas) ---
  const totalVentas = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCobrado = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPorCobrar = invoices.reduce((sum, i) => sum + Math.max(0, i.total - i.paidAmount), 0);
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
            <div className="stat-desc">{invoices.length} factura(s) emitida(s)</div>
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
              ⏳ Facturas con Saldo Pendiente
            </h3>
          </div>
          <div className="glass-panel table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  <th>FACTURA</th>
                  <th>FECHA</th>
                  <th>CONCEPTO</th>
                  <th>TOTAL</th>
                  <th>COBRADO</th>
                  <th>POR COBRAR</th>
                </tr>
              </thead>
              <tbody>
                {invoices
                  .filter((i) => i.total - i.paidAmount > 0.004)
                  .sort((a, b) => (b.total - b.paidAmount) - (a.total - a.paidAmount))
                  .map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <Link href={`/clientes/${invoice.clientId}/estado-de-cuenta`} className="link">{invoice.client.name}</Link><br/>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{invoice.client.code}</span>
                      </td>
                      <td className="mono">{invoiceCode(invoice.number)}</td>
                      <td>{new Date(invoice.issueDate).toLocaleDateString('es-ES')}</td>
                      <td>{INVOICE_TYPE[invoice.type]}</td>
                      <td><strong>${invoice.total.toFixed(2)}</strong></td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>${invoice.paidAmount.toFixed(2)}</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>${(invoice.total - invoice.paidAmount).toFixed(2)}</td>
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
