import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import PrintButton from './PrintButton';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EstadoDeCuentaPage({ params }: Props) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        include: { products: true },
        orderBy: { orderDate: 'asc' },
      },
      adjustments: {
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!client) notFound();

  type LedgerEntry = {
    date: Date;
    ref: string;
    orderId?: string;
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
      orderId: o.id,
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
  const paidOrders = client.orders.filter(o => o.balance === 0).length;
  const pendingOrders = client.orders.filter(o => o.balance > 0).length;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href={`/clientes/${id}`} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            &larr; Volver
          </Link>
          <div>
            <h1 className="page-title">Estado de Cuenta</h1>
            <p className="page-subtitle">{client.name} — Código: <strong>{client.code}</strong></p>
          </div>
        </div>
        <PrintButton />
      </header>

      {/* Balance summary */}
      <div style={{ marginBottom: '32px' }}>
        <div className="glass-panel" style={{
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderLeft: `6px solid ${netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : '#6366f1'}`,
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Saldo Neto
            </div>
            <div style={{ fontSize: '2.8rem', fontWeight: 800, color: netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : 'var(--text-primary)', lineHeight: 1 }}>
              ${Math.abs(netBalance).toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {netBalance > 0 && (
              <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700, fontSize: '1rem' }}>
                El cliente debe ${netBalance.toFixed(2)} a ShopUSA
              </div>
            )}
            {netBalance < 0 && (
              <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700, fontSize: '1rem' }}>
                ShopUSA debe ${Math.abs(netBalance).toFixed(2)} al cliente
              </div>
            )}
            {netBalance === 0 && (
              <div style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700, fontSize: '1rem' }}>
                ✓ Cuenta al día
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-panel stat-card" style={{ padding: '18px' }}>
          <div className="stat-title">Total Cargado</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#ef4444' }}>
            ${ledger.reduce((s, e) => s + e.cargo, 0).toFixed(2)}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '18px' }}>
          <div className="stat-title">Total Abonado</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#10b981' }}>
            ${ledger.reduce((s, e) => s + e.abono, 0).toFixed(2)}
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '18px' }}>
          <div className="stat-title">Pedidos Pagados</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#10b981' }}>{paidOrders}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '18px' }}>
          <div className="stat-title">Pedidos Pendientes</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: pendingOrders > 0 ? '#ef4444' : 'var(--text-primary)' }}>{pendingOrders}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '18px' }}>
          <div className="stat-title">Ajustes</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{client.adjustments.length}</div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>PEDIDO #</th>
              <th>DESCRIPCIÓN</th>
              <th>ESTADO</th>
              <th style={{ textAlign: 'right' }}>CARGO (+)</th>
              <th style={{ textAlign: 'right' }}>ABONO (−)</th>
              <th style={{ textAlign: 'right' }}>SALDO</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No hay movimientos registrados para este cliente.
                </td>
              </tr>
            )}
            {ledger.map((entry, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                  {entry.date.toLocaleDateString('es-ES')}
                </td>
                <td>
                  {entry.kind === 'order' ? (
                    <Link href={`/pedidos/${entry.orderId}`} style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--accent-color)', textDecoration: 'none' }}>
                      {entry.ref} ↗
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {entry.cargo > 0 ? '🔴 Cargo' : '🟢 Crédito'}
                    </span>
                  )}
                </td>
                <td style={{ maxWidth: '200px' }}>{entry.description}</td>
                <td>
                  {entry.kind === 'order' ? (
                    <span className={`badge ${entry.isPaid ? 'badge-success' : 'badge-warning'}`}>
                      {entry.isPaid ? '✓ Pagado' : '⏳ Pendiente'}
                    </span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>Ajuste</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: entry.cargo > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {entry.cargo > 0 ? `$${entry.cargo.toFixed(2)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: entry.abono > 0 ? '#10b981' : 'var(--text-muted)' }}>
                  {entry.abono > 0 ? `$${entry.abono.toFixed(2)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: entry.saldo > 0 ? '#ef4444' : entry.saldo < 0 ? '#10b981' : '#6366f1' }}>
                  ${Math.abs(entry.saldo).toFixed(2)}
                  {entry.saldo !== 0 && (
                    <span style={{ fontSize: '0.7rem', marginLeft: '4px', opacity: 0.7 }}>
                      {entry.saldo > 0 ? '↑' : '↓'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {ledger.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid rgba(128,128,128,0.2)' }}>
                <td colSpan={4} style={{ fontWeight: 700, padding: '14px 16px' }}>SALDO FINAL</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', padding: '14px 16px' }}>
                  ${ledger.reduce((s, e) => s + e.cargo, 0).toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', padding: '14px 16px' }}>
                  ${ledger.reduce((s, e) => s + e.abono, 0).toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: netBalance > 0 ? '#ef4444' : netBalance < 0 ? '#10b981' : '#6366f1', padding: '14px 16px' }}>
                  ${Math.abs(netBalance).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
