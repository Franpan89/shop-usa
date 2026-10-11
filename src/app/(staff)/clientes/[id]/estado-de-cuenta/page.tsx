import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getClientAccount, getStatement } from '@/lib/accounting';
import { INVOICE_STATUS, INVOICE_TYPE } from '@/lib/domain/flow';
import { invoiceCode } from '@/lib/logistics';
import { Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, money, shortDate } from '@/components/ui/kit';
import { RegisterPaymentModal } from '@/components/finance/FinanceModals';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/** Historial financiero único del cliente: cargos, pagos, créditos y saldo resultante (7.5 / 7.15). */
export default async function EstadoDeCuentaPage({ params }: Props) {
  await requireStaff();
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, code: true } });
  if (!client) notFound();

  const [account, rows, invoices] = await Promise.all([
    getClientAccount(prisma, id),
    getStatement(prisma, id, { staffLinks: true }),
    prisma.invoice.findMany({ where: { clientId: id, status: { not: 'CANCELLED' } }, orderBy: [{ issueDate: 'desc' }, { number: 'desc' }] }),
  ]);

  const openInvoices = invoices.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').reverse();

  return (
    <>
      <PageHeader
        back={{ href: `/clientes/${id}`, label: client.name }}
        title="Estado de cuenta"
        subtitle={`${client.name} · ${client.code}`}
        actions={
          <>
            <RegisterPaymentModal
              clientId={id}
              invoices={openInvoices.map((i) => ({ id: i.id, label: `${invoiceCode(i.number)} — ${i.description ?? INVOICE_TYPE[i.type]}`, balance: i.total - i.paidAmount }))}
            />
            <PrintButton />
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Saldo pendiente" value={money(account.pending)} tone={account.pending > 0.004 ? 'danger' : 'success'} hint="Lo que el cliente debe" />
        <Kpi label="Saldo a favor" value={money(account.credit)} tone={account.credit > 0.004 ? 'success' : undefined} hint="Se aplica solo al próximo cargo" />
        <Kpi label="Total cargado" value={money(account.charged)} />
        <Kpi label="Total pagado" value={money(account.paid)} />
      </KpiGrid>

      <div className="stack">
        <Panel title="Facturas" subtitle="Cada despacho o pedido conserva su propia factura y su saldo." flush>
          {invoices.length === 0 ? (
            <Empty icon="🧾" title="Sin facturas" />
          ) : (
            <div className="table-container" style={{ padding: '0 16px 16px' }}>
              <table className="data-table compact">
                <thead>
                  <tr><th>FACTURA</th><th>FECHA</th><th>CONCEPTO</th><th>ESTADO</th><th className="text-right">TOTAL</th><th className="text-right">PAGADO</th><th className="text-right">SALDO</th></tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="mono strong">{invoiceCode(i.number)}</td>
                      <td>{shortDate(i.issueDate)}</td>
                      <td>{i.description ?? INVOICE_TYPE[i.type]}</td>
                      <td><StatusBadge meta={INVOICE_STATUS[i.status]} small /></td>
                      <td className="text-right">{money(i.total)}</td>
                      <td className="text-right">{money(i.paidAmount)}</td>
                      <td className="text-right">{i.total - i.paidAmount > 0.004 ? <span className="money-due">{money(i.total - i.paidAmount)}</span> : <span className="money-ok">$0.00</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Movimientos" subtitle="Cronológico, con el saldo después de cada movimiento. Positivo = debe · negativo = saldo a favor." flush>
          {rows.length === 0 ? (
            <Empty icon="📋" title="Todavía no hay movimientos" />
          ) : (
            <div className="table-container" style={{ padding: '0 16px 16px' }}>
              <table className="data-table compact">
                <thead>
                  <tr><th>FECHA</th><th>MOVIMIENTO</th><th>REFERENCIA</th><th className="text-right">CARGO</th><th className="text-right">PAGO / CRÉDITO</th><th className="text-right">SALDO</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} style={r.informational ? { opacity: 0.55 } : undefined}>
                      <td className="nowrap">{shortDate(r.date)}</td>
                      <td>
                        {r.href ? <Link href={r.href} className="link">{r.description}</Link> : r.description}
                        {r.statusLabel && r.statusLabel !== 'Aprobado' && r.statusLabel !== 'Pendiente' && r.statusLabel !== 'Pagada' && (
                          <span className="muted small"> · {r.statusLabel}</span>
                        )}
                      </td>
                      <td className="mono small">{r.reference ?? '—'}</td>
                      <td className="text-right" style={{ color: r.charge > 0 ? 'var(--color-danger)' : undefined }}>{r.charge > 0 ? money(r.charge) : '—'}</td>
                      <td className="text-right" style={{ color: r.credit > 0 ? 'var(--color-success)' : undefined }}>{r.credit > 0 ? money(r.credit) : '—'}</td>
                      <td className="text-right strong" style={{ color: r.balance > 0.004 ? 'var(--color-danger)' : r.balance < -0.004 ? 'var(--color-success)' : undefined }}>
                        {r.informational ? '' : money(Math.abs(r.balance))}
                        {!r.informational && r.balance < -0.004 ? ' a favor' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
