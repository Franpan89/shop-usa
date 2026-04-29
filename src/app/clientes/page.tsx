import prisma from '@/lib/prisma';
import NewClientModal from './NewClientModal';
import Link from 'next/link';
import SearchFilter from '@/components/SearchFilter';

interface ClientesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const { q } = await searchParams;
  
  // Get the first tenant for now
  const tenant = await prisma.tenant.findFirst();
  
  const clients = tenant ? await prisma.client.findMany({
    where: { 
      tenantId: tenant.id,
      OR: q ? [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { idNumber: { contains: q, mode: 'insensitive' } },
      ] : undefined
    },
    include: {
      orders: true,
    },
    orderBy: { createdAt: 'desc' }
  }) : [];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Lista de todos los clientes incluyendo su información de contacto y resumen de pedidos.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <NewClientModal />
        </div>
      </header>

      <div className="filter-bar">
        <SearchFilter placeholder="Nombre, código o ID..." />
        <div className="input-container">
          <label>Estado de Pedidos</label>
          <select className="input-field">
            <option>Todos</option>
            <option>Al Día</option>
            <option>Con Deuda</option>
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

      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', borderLeft: '4px solid var(--accent-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>ℹ️</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Mostrando todos los clientes registrados. <strong>{clients.length} cliente(s) encontrado(s).</strong>
          </span>
        </div>
        {q && (
          <Link href="/clientes" style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600 }}>
            ✕ Limpiar Búsqueda
          </Link>
        )}
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
              <th>ENTREGA</th>
              <th>PEDIDOS</th>
              <th>TOTAL</th>
              <th>PAGADO</th>
              <th>BALANCE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const totalAmount = client.orders.reduce((sum, o) => sum + o.totalAmount, 0);
              const totalBalance = client.orders.reduce((sum, o) => sum + o.balance, 0);
              const totalPaid = totalAmount - totalBalance;

              return (
                <tr key={client.id}>
                  <td>{client.code}</td>
                  <td>
                    <Link href={`/clientes/${client.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <strong style={{ cursor: 'pointer', borderBottom: '1px dashed var(--accent-color)' }}>
                        {client.name}
                      </strong>
                    </Link>
                    {client.idNumber && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {client.idNumber}</div>
                    )}
                  </td>
                  <td>{client.country}</td>
                  <td>{client.city}</td>
                  <td>{client.phone}</td>
                  <td>
                    <span className={`badge ${client.deliveryMethod === 'STORE_PICKUP' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                      {client.deliveryMethod === 'STORE_PICKUP' ? '🏪 Retiro' : '🏠 Envío'}
                    </span>
                  </td>
                  <td>{client.orders.length}</td>
                  <td>${totalAmount.toFixed(2)}</td>
                  <td style={{ color: '#10b981', fontWeight: 600 }}>${totalPaid.toFixed(2)}</td>
                  <td style={{ color: totalBalance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    ${totalBalance.toFixed(2)}
                  </td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <Link href={`/clientes/${client.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Detalles">📄</Link>
                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Pedidos">📦</button>
                    <Link href={`/clientes/${client.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem' }} title="Editar">✏️</Link>
                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  No se encontraron clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

