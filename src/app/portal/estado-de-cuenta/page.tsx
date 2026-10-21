import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { getClientAccount, getStatement } from '@/lib/accounting';
import { getSettings } from '@/lib/tenant';
import { isSquareConfigured } from '@/lib/square';
import { INVOICE_STATUS, INVOICE_TYPE } from '@/lib/domain/flow';
import { invoiceCode } from '@/lib/logistics';
import { Empty, StatusBadge, money, shortDate } from '@/components/ui/kit';
import { CardReturn, PayActions } from '../PortalControls';

export const dynamic = 'force-dynamic';

/** Todo lo que el cliente pregunta por WhatsApp: cuánto debo, cuánto abonaré, qué incluye mi saldo (7.14 / 7.15). */
export default async function PortalEstadoDeCuenta({ searchParams }: { searchParams: Promise<{ tarjeta?: string }> }) {
  const me = await requirePortalClient();
  const { tarjeta } = await searchParams;
  const settings = await getSettings();
  const [account, rows, invoices] = await Promise.all([
    getClientAccount(prisma, me.id),
    getStatement(prisma, me.id),
    prisma.invoice.findMany({ where: { clientId: me.id, status: { not: 'CANCELLED' } }, orderBy: [{ issueDate: 'desc' }, { number: 'desc' }] }),
  ]);
  const open = invoices.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').reverse();
  const due = account.pending > 0.004;

  return (
    <div className="stack">
      {tarjeta && <CardReturn checkoutId={tarjeta} />}

      <section className="balance-card">
        <span className="balance-label">{due ? 'Saldo pendiente' : account.credit > 0.004 ? 'Saldo a favor' : 'Estás al día'}</span>
        <span className={`balance-amount ${due ? 'is-due' : 'is-ok'}`}>{money(due ? account.pending : account.credit)}</span>
        <span className="balance-hint">{due ? 'Elige cómo quieres pagar' : account.credit > 0.004 ? 'Se aplica a tu próximo cargo' : 'No tienes pagos pendientes'}</span>
        <PayActions
          invoices={open.map((i) => ({ id: i.id, label: i.description ?? INVOICE_TYPE[i.type], balance: i.total - i.paidAmount }))}
          pendingTotal={due ? account.pending : 0}
          instructions={settings.paymentInstructions}
          cardEnabled={isSquareConfigured()}
        />
        <div className="balance-stats">
          <div><span>A favor</span><strong>{money(account.credit)}</strong></div>
          <div><span>Total pagado</span><strong>{money(account.paid)}</strong></div>
        </div>
      </section>

      <section>
        <h2 className="list-title">Mis facturas</h2>
        {invoices.length === 0 ? (
          <div className="glass-panel static"><Empty icon="🧾" title="Sin facturas" /></div>
        ) : (
          <div className="item-list">
            {invoices.map((i) => {
              const balance = i.total - i.paidAmount;
              return (
                <div key={i.id} className="item-card">
                  <div className="item-top">
                    <div>
                      <strong className="mono">{invoiceCode(i.number)}</strong>
                      <div className="item-sub">{i.description ?? INVOICE_TYPE[i.type]}</div>
                    </div>
                    <StatusBadge meta={INVOICE_STATUS[i.status]} small />
                  </div>
                  <div className="item-bottom">
                    <span className="item-sub">{shortDate(i.issueDate)}</span>
                    <span className="item-money">
                      <span className="item-sub">Total {money(i.total)}</span>
                      {balance > 0.004 ? <strong className="money-due">Debes {money(balance)}</strong> : <strong className="money-ok">Pagada</strong>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="list-title">Movimientos</h2>
        <p className="item-sub" style={{ margin: '-6px 0 10px' }}>Cargos en rojo, pagos en verde.</p>
        {rows.length === 0 ? (
          <div className="glass-panel static"><Empty icon="📋" title="Todavía no hay movimientos" /></div>
        ) : (
          <div className="item-list">
            {rows.map((r) => (
              <div key={r.key} className="item-card compact" style={r.informational ? { opacity: 0.55 } : undefined}>
                <div className="item-top">
                  <div>
                    {r.href ? <Link href={r.href} className="link strong">{r.description}</Link> : <span className="strong">{r.description}</span>}
                    <div className="item-sub">
                      {shortDate(r.date)}
                      {r.statusLabel && ['Por verificar', 'Rechazado', 'Anulado', 'Anulada'].includes(r.statusLabel) && ` · ${r.statusLabel}`}
                    </div>
                  </div>
                  <div className="item-money">
                    {r.charge > 0 && <strong className="money-due">+{money(r.charge)}</strong>}
                    {r.credit > 0 && <strong className="money-ok">−{money(r.credit)}</strong>}
                    {!r.informational && <span className="item-sub">Saldo {money(Math.abs(r.balance))}{r.balance < -0.004 ? ' a favor' : ''}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
