import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PortalEstadoDeCuentaPage() {
  const currentClient = await requirePortalClient();

  const client = await prisma.client.findUnique({
    where: { id: currentClient.id },
    include: {
      orders: { include: { products: true }, orderBy: { orderDate: 'asc' } },
      adjustments: { orderBy: { date: 'asc' } },
    },
  });

  if (!client) return null;

  type LedgerEntry = {
    date: Date;
    ref: string;
    description: string;
    cargo: number;
    abono: number;
    kind: 'order' | 'adjustment';
    isPaid?: boolean;
  };

  const entries: LedgerEntry[] = [
    ...client.orders.map(o => ({
      date: new Date(o.orderDate),
      ref: `#${o.id.slice(-6).toUpperCase()}`,
      description: o.products.map(p => p.name).join(', ') || '—',
      cargo: o.totalAmount,
      abono: o.totalAmount - o.balance,
      kind: 'order' as const,
      isPaid: o.balance === 0,
    })),
    ...client.adjustments.map(a => ({
      date: new Date(a.date),
      ref: '—',
      description: a.description,
      cargo: a.type === 'CARGO' ? a.amount : 0,
      abono: a.type === 'CREDITO' ? a.amount : 0,
      kind: 'adjustment' as const,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const ledger = entries.map(e => {
    running += e.cargo - e.abono;
    return { ...e, saldo: running };
  });

  const netBalance = running;

  return (
    <div style={{ padding: '32px' }}>
      <h1 className="page-title" style={{ marginBottom: '4px' }}>Estado de Cuenta</h1>
      <p className="page-subtitle" style={{ marginBottom: '24px' }}>{client.name} — Código: <strong>{client.code}</strong></p>

      <div className="glass-panel" style={{
        padding: '28px 32px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderLeft: `6px solid ${netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : '#6366f1'}`,
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Saldo Neto
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : 'var(--text-primary)', lineHeight: 1 }}>
            ${Math.abs(netBalance).toFixed(2)}
          </div>
        </div>
        <div>
          {netBalance > 0 && <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }}>Debes ${netBalance.toFixed(2)}</div>}
          {netBalance < 0 && <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>Tienes un crédito de ${Math.abs(netBalance).toFixed(2)}</div>}
          {netBalance === 0 && <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700 }}>✓ Cuenta al día</div>}
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>PEDIDO #</th>
              <th>DESCRIPCIÓN</th>
              <th>ESTADO</th>
              <th style={{ textAlign: 'right' }}>CARGO</th>
              <th style={{ textAlign: 'right' }}>ABONO</th>
              <th style={{ textAlign: 'right' }}>SALDO</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay movimientos registrados todavía.</td></tr>
            )}
            {ledger.map((entry, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{entry.date.toLocaleDateString('es-ES')}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{entry.ref}</td>
                <td style={{ maxWidth: '200px' }}>{entry.description}</td>
                <td>
                  {entry.kind === 'order' ? (
                    <span className={`badge ${entry.isPaid ? 'badge-success' : 'badge-warning'}`}>{entry.isPaid ? '✓ Pagado' : '⏳ Pendiente'}</span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>Ajuste</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: entry.cargo > 0 ? '#ef4444' : 'var(--text-muted)' }}>{entry.cargo > 0 ? `$${entry.cargo.toFixed(2)}` : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: entry.abono > 0 ? '#10b981' : 'var(--text-muted)' }}>{entry.abono > 0 ? `$${entry.abono.toFixed(2)}` : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: entry.saldo > 0 ? '#ef4444' : entry.saldo < 0 ? '#10b981' : '#6366f1' }}>${Math.abs(entry.saldo).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
