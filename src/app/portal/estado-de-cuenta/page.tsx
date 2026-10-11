import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { getClientAccount, getStatement } from '@/lib/accounting';
import { getSettings } from '@/lib/tenant';
import { INVOICE_STATUS, INVOICE_TYPE } from '@/lib/domain/flow';
import { invoiceCode } from '@/lib/logistics';
import { Empty, Kpi, KpiGrid, Panel, StatusBadge, money, shortDate } from '@/components/ui/kit';
import { TransferButton } from '../PortalControls';

export const dynamic = 'force-dynamic';

/** Todo lo que el cliente pregunta por WhatsApp: cuánto debo, cuánto abonaré, qué incluye mi saldo (7.14 / 7.15). */
export default async function PortalEstadoDeCuenta() {
  const me = await requirePortalClient();
  const settings = await getSettings();
  const [account, rows, invoices] = await Promise.all([
    getClientAccount(prisma, me.id),
    getStatement(prisma, me.id),
    prisma.invoice.findMany({ where: { clientId: me.id, status: { not: 'CANCELLED' } }, orderBy: [{ issueDate: 'desc' }, { number: 'desc' }] }),
  ]);
  const open = invoices.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').reverse();

  return (
    <div style={{ padding: 32 }}>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Estado de cuenta</h1>
          <p className="page-subtitle">Tus cargos, pagos y saldo.</p>
        </div>
        <TransferButton
          invoices={open.map((i) => ({ id: i.id, label: i.description ?? INVOICE_TYPE[i.type], balance: i.total - i.paidAmount }))}
          defaultAmount={account.pending > 0.004 ? account.pending : undefined}
          instructions={settings.paymentInstructions}
        />
      </div>

      <KpiGrid>
        <Kpi label="Saldo pendiente" value={money(account.pending)} tone={account.pending > 0.004 ? 'danger' : 'success'} />
        <Kpi label="Saldo a favor" value={money(account.credit)} tone={account.credit > 0.004 ? 'success' : undefined} hint="Se aplica solo a tu próximo cargo" />
        <Kpi label="Total pagado" value={money(account.paid)} />
      </KpiGrid>

      <div className="stack">
        <Panel title="Mis facturas" flush>
          {invoices.length === 0 ? <Empty icon="🧾" title="Sin facturas" /> : (
            <div className="table-container" style={{ padding: '0 16px 16px' }}>
              <table className="data-table compact">
                <thead><tr><th>FACTURA</th><th>FECHA</th><th>CONCEPTO</th><th>ESTADO</th><th className="text-right">TOTAL</th><th className="text-right">SALDO</th></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="mono strong">{invoiceCode(i.number)}</td>
                      <td>{shortDate(i.issueDate)}</td>
                      <td>{i.description ?? INVOICE_TYPE[i.type]}</td>
                      <td><StatusBadge meta={INVOICE_STATUS[i.status]} small /></td>
                      <td className="text-right">{money(i.total)}</td>
                      <td className="text-right">{i.total - i.paidAmount > 0.004 ? <span className="money-due">{money(i.total - i.paidAmount)}</span> : <span className="money-ok">$0.00</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Movimientos" subtitle="Positivo = debes · negativo = saldo a favor." flush>
          {rows.length === 0 ? <Empty icon="📋" title="Todavía no hay movimientos" /> : (
            <div className="table-container" style={{ padding: '0 16px 16px' }}>
              <table className="data-table compact">
                <thead><tr><th>FECHA</th><th>MOVIMIENTO</th><th className="text-right">CARGO</th><th className="text-right">PAGO</th><th className="text-right">SALDO</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} style={r.informational ? { opacity: 0.55 } : undefined}>
                      <td className="nowrap">{shortDate(r.date)}</td>
                      <td>
                        {r.href ? <Link href={r.href} className="link">{r.description}</Link> : r.description}
                        {r.statusLabel && ['Por verificar', 'Rechazado', 'Anulado', 'Anulada'].includes(r.statusLabel) && <span className="muted small"> · {r.statusLabel}</span>}
                      </td>
                      <td className="text-right">{r.charge > 0 ? money(r.charge) : '—'}</td>
                      <td className="text-right" style={{ color: r.credit > 0 ? '#10b981' : undefined }}>{r.credit > 0 ? money(r.credit) : '—'}</td>
                      <td className="text-right strong">{r.informational ? '' : `${money(Math.abs(r.balance))}${r.balance < -0.004 ? ' a favor' : ''}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
