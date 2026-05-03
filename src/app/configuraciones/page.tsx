import prisma from '@/lib/prisma';
import { upsertCountryRate, deleteCountryRate } from '../actions/shipping';
import AddCountryForm from './AddCountryForm';

function calcTiers(rate: number, count = 8) {
  return Array.from({ length: count }, (_, i) => ({
    min: i === 0 ? 0.01 : parseFloat((i * 0.5 + 0.01).toFixed(2)),
    max: parseFloat(((i + 1) * 0.5).toFixed(2)),
    cost: parseFloat(((i + 1) * rate).toFixed(2)),
  }));
}

export default async function ConfiguracionesPage() {
  const tenant = await prisma.tenant.findFirst();

  if (!tenant) {
    return <p style={{ padding: '40px' }}>No hay tenant configurado.</p>;
  }

  let rates = await prisma.shippingCountryRate.findMany({
    where: { tenantId: tenant.id },
    orderBy: { country: 'asc' },
  });

  // Seed defaults if none exist
  if (rates.length === 0) {
    await prisma.shippingCountryRate.createMany({
      data: [
        { tenantId: tenant.id, country: 'Ecuador', ratePerHalfLb: 4.25 },
        { tenantId: tenant.id, country: 'Panamá', ratePerHalfLb: 4.25 },
      ],
    });
    rates = await prisma.shippingCountryRate.findMany({
      where: { tenantId: tenant.id },
      orderBy: { country: 'asc' },
    });
  }

  async function handleDelete(formData: FormData) {
    'use server';
    await deleteCountryRate(formData.get('id') as string);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Configuraciones</h1>
          <p className="page-subtitle">Tablas de costos de envío por país y configuraciones globales.</p>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Costos de Envío por País</h2>
        <AddCountryForm existingCountries={rates.map(r => r.country)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
        {rates.map(rate => {
          const tiers = calcTiers(rate.ratePerHalfLb);
          return (
            <div key={rate.id} className="glass-panel" style={{ padding: '28px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{rate.country}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ${rate.ratePerHalfLb.toFixed(2)} por cada 0.5 lbs
                  </div>
                </div>
                <form action={handleDelete}>
                  <input type="hidden" name="id" value={rate.id} />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.95rem', color: '#ef4444' }}
                    title="Eliminar país"
                  >
                    🗑️
                  </button>
                </form>
              </div>

              {/* Edit rate form */}
              <form action={upsertCountryRate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <input type="hidden" name="country" value={rate.country} />
                <div className="input-container" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Tarifa por 0.5 lbs ($)</label>
                  <input
                    name="ratePerHalfLb"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field"
                    defaultValue={rate.ratePerHalfLb}
                    style={{ padding: '8px 12px' }}
                    required
                  />
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
                        Más de {(tiers.length * 0.5).toFixed(2)} lbs…
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        +${rate.ratePerHalfLb.toFixed(2)}/0.5 lbs
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
