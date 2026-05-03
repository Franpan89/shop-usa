import prisma from '@/lib/prisma';
// Rebuild trigger
import Link from 'next/link';
import NewOrderModal from './NewOrderModal';

export default async function PedidosPage() {
  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  
  const clients = tenant ? await prisma.client.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, code: true, serviceFeePercent: true, country: true, shippingRatePerHalfLb: true },
    orderBy: { name: 'asc' }
  }) : [];

  const shippingRatesList = tenant ? await prisma.shippingCountryRate.findMany({
    where: { tenantId: tenant.id },
  }) : [];
  const shippingRates: Record<string, number> = Object.fromEntries(
    shippingRatesList.map(r => [r.country, r.ratePerHalfLb])
  );

  const orders = tenant ? await prisma.order.findMany({
    where: { tenantId: tenant.id },
    include: {
      client: true,
      box: true,
      products: true,
    },
    orderBy: { orderDate: 'desc' }
  }) : [];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">Lista de pedidos con información de asignación de productos a cajas.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <NewOrderModal clients={clients} shippingRates={shippingRates} />
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
            <option>PENDING</option>
            <option>IN_TRANSIT</option>
            <option>DELIVERED</option>
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
              <th>PESO</th>
              <th>CAJA</th>
              <th>TOTAL / BALANCE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/clientes/${order.client.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <strong>{order.client.name}</strong>
                  </Link>
                  <br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.client.code}</span>
                </td>
                <td>
                  ID Pedido: {order.id.slice(-4).toUpperCase()} 
                  <br/>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>País: {order.client.country.slice(0, 2).toUpperCase()}</span>
                </td>
                <td>{new Date(order.orderDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  <span className={`badge ${
                    order.status === 'DELIVERED' ? 'badge-success' : 
                    order.status === 'IN_TRANSIT' ? 'badge-warning' : 'badge-secondary'
                  }`}>
                    {order.status === 'DELIVERED' ? 'Entregado' : 
                     order.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Pendiente'}
                  </span>
                </td>
                <td>{order.products.length} prod.</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {order.products.reduce((s, p) => s + p.weight, 0).toFixed(2)} lbs
                </td>
                <td>
                  {order.box ? (
                    <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>📦 {order.box.internalId}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Sin caja</span>
                  )}
                </td>
                <td>
                  <strong>${order.totalAmount.toFixed(2)}</strong><br/>
                  <span style={{ fontSize: '0.8rem', color: order.balance > 0 ? '#ef4444' : '#10b981' }}>
                    Bal: ${order.balance.toFixed(2)}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Asignar Caja">📦</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Registrar Pago">💳</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Editar">✏️</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }} title="Eliminar">🗑️</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No se encontraron pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

