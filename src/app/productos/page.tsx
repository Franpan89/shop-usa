import prisma from '@/lib/prisma';
import NewCatalogEntryModal from './NewCatalogEntryModal';
import CatalogRowActions from './CatalogRowActions';

export default async function ProductosPage() {
  const tenant = await prisma.tenant.findFirst();

  const entries = tenant ? await prisma.productCatalog.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ timesShipped: 'desc' }, { name: 'asc' }],
  }) : [];

  const totalEntries = entries.length;
  const totalShipments = entries.reduce((s, e) => s + e.timesShipped, 0);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Productos</h1>
          <p className="page-subtitle">
            Productos enviados previamente. Se usan para autocompletar peso, valor y otros datos al crear nuevos pedidos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <NewCatalogEntryModal />
        </div>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Productos en Catálogo</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalEntries}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '20px' }}>
          <div className="stat-title">Envíos Totales Registrados</div>
          <div className="stat-value" style={{ fontSize: '1.8rem' }}>{totalShipments}</div>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>PRODUCTO</th>
              <th>PESO POR DEFECTO</th>
              <th>VALOR POR DEFECTO</th>
              <th>COMPRADO POR</th>
              <th>VECES ENVIADO</th>
              <th>ÚLTIMO USO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.name}</strong>
                  {e.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{e.notes}</div>
                  )}
                </td>
                <td>{e.defaultWeight != null ? `${e.defaultWeight.toFixed(2)} lbs` : '—'}</td>
                <td>{e.defaultPurchaseValue != null ? `$${e.defaultPurchaseValue.toFixed(2)}` : '—'}</td>
                <td>
                  <span className={`badge ${e.defaultPurchasedBy === 'SHOPUSA' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.75rem' }}>
                    {e.defaultPurchasedBy === 'SHOPUSA' ? '🏪 ShopUSA' : '👤 Cliente'}
                  </span>
                </td>
                <td><strong>{e.timesShipped}</strong></td>
                <td>{e.lastUsedAt ? new Date(e.lastUsedAt).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <CatalogRowActions
                    entry={{
                      id: e.id,
                      name: e.name,
                      defaultWeight: e.defaultWeight,
                      defaultPurchaseValue: e.defaultPurchaseValue,
                      defaultPurchasedBy: e.defaultPurchasedBy as 'CLIENT' | 'SHOPUSA',
                      notes: e.notes,
                    }}
                  />
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  Aún no hay productos en el catálogo. Crea uno o serán agregados automáticamente al registrar pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
