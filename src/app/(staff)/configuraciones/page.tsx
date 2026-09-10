import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { updateShippingCategory, deleteShippingCategory } from '../../actions/shipping';
import AddCategoryForm from './AddCategoryForm';

export const dynamic = 'force-dynamic';

function calcTiers(rate: number, divisor: number, count = 8) {
  return Array.from({ length: count }, (_, i) => ({
    min: i === 0 ? 0.01 : parseFloat((i * divisor + 0.01).toFixed(2)),
    max: parseFloat(((i + 1) * divisor).toFixed(2)),
    cost: parseFloat(((i + 1) * rate).toFixed(2)),
  }));
}

export default async function ConfiguracionesPage() {
  await requireAdmin();

  const tenant = await prisma.tenant.findFirst();

  if (!tenant) {
    return <p style={{ padding: '40px' }}>No hay tenant configurado.</p>;
  }

  let categories = await prisma.shippingCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ country: 'asc' }, { name: 'asc' }],
  });

  // Seed defaults if none exist
  if (categories.length === 0) {
    await prisma.shippingCategory.createMany({
      data: [
        { tenantId: tenant.id, name: 'Ecuador Normal', country: 'Ecuador', rate: 3.75, unit: 'HALF_LB' },
        { tenantId: tenant.id, name: 'Ecuador Migrante', country: 'Ecuador', rate: 3.25, unit: 'HALF_LB' },
        { tenantId: tenant.id, name: 'Ecuador Emprendedor', country: 'Ecuador', rate: 5.41, unit: 'LB' },
        { tenantId: tenant.id, name: 'Panamá', country: 'Panamá', rate: 2.75, unit: 'HALF_LB' },
      ],
    });
    categories = await prisma.shippingCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });
  }

  async function handleDelete(formData: FormData) {
    'use server';
    await deleteShippingCategory(formData.get('id') as string);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Configuraciones</h1>
          <p className="page-subtitle">Categorías de envío por cliente y configuraciones globales.</p>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Categorías de Envío</h2>
        <AddCategoryForm existingNames={categories.map(c => c.name)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
        {categories.map(category => {
          const divisor = category.unit === 'LB' ? 1 : 0.5;
          const tiers = calcTiers(category.rate, divisor);
          const unitLabel = category.unit === 'LB' ? 'lb' : '0.5 lbs';
          return (
            <div key={category.id} className="glass-panel" style={{ padding: '28px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{category.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {category.country} · ${category.rate.toFixed(2)} por cada {unitLabel}
                  </div>
                </div>
                <form action={handleDelete}>
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.95rem', color: '#ef4444' }}
                    title="Eliminar categoría"
                  >
                    🗑️
                  </button>
                </form>
              </div>

              {/* Edit rate form */}
              <form action={updateShippingCategory} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <input type="hidden" name="id" value={category.id} />
                <div className="input-container" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Tarifa ($)</label>
                  <input
                    name="rate"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field"
                    defaultValue={category.rate}
                    style={{ padding: '8px 12px' }}
                    required
                  />
                </div>
                <div className="input-container" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Unidad</label>
                  <select name="unit" className="input-field" defaultValue={category.unit} style={{ padding: '8px 12px' }}>
                    <option value="HALF_LB">por 0.5 lbs</option>
                    <option value="LB">por lb</option>
                  </select>
                </div>
                <button type="submit" className="btn" style={{ padding: '8px 18px', whiteSpace: 'nowrap' }}>
                  Actualizar
                </button>
              </form>

              {/* Tier preview table */}
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(128,128,128,0.08)' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.06em' }}>PESO (lbs)</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.06em' }}>COSTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)' }}>
                        <td style={{ padding: '7px 14px', color: 'var(--text-muted)' }}>
                          {tier.min.toFixed(2)} – {tier.max.toFixed(2)} lbs
                        </td>
                        <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-color)' }}>
                          ${tier.cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(128,128,128,0.04)' }}>
                      <td style={{ padding: '7px 14px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        Más de {(tiers.length * divisor).toFixed(2)} lbs…
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        +${category.rate.toFixed(2)}/{unitLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
