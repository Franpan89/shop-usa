import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { signedProofUrls } from '@/lib/storage';
import { INVOICE_TYPE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from '@/lib/domain/flow';
import { invoiceCode, orderCode } from '@/lib/logistics';
import { Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, Tabs, longDateTime, money, shortDate } from '@/components/ui/kit';
import PaymentReview from '@/components/finance/PaymentReview';
import { RegisterPaymentModal } from '@/components/finance/FinanceModals';
import { VoidPaymentButton } from './PaymentActions';

export const dynamic = 'force-dynamic';

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const user = await requireStaff();
  const { vista = 'verificar' } = await searchParams;
  const tenantId = await getTenantId();

  const [pending, history, invoices, clients] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, status: 'PENDING_VERIFICATION' },
      include: { client: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { tenantId, status: { not: 'PENDING_VERIFICATION' } },
      include: { client: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.invoice.findMany({
      where: { tenantId, status: { in: ['PENDING', 'PARTIAL'] } },
      include: { client: { select: { id: true, name: true, code: true } }, order: { select: { number: true } } },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    }),
    prisma.client.findMany({ where: { tenantId }, select: { id: true, name: true, code: true, country: true }, orderBy: { name: 'asc' } }),
  ]);

  // Facturas a las que apuntan los comprobantes pendientes (para mostrar "Pedido #012").
  const targetIds = pending.map((p) => p.targetInvoiceId).filter((id): id is string => !!id);
  const targets = targetIds.length
    ? await prisma.invoice.findMany({ where: { id: { in: targetIds } }, include: { order: { select: { number: true } } } })
    : [];
  const targetById = new Map(targets.map((t) => [t.id, t]));
  const proofs = await signedProofUrls(pending.map((p) => p.proofUrl));

  const receivable = invoices.reduce((s, i) => s + (i.total - i.paidAmount), 0);
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle="Los pagos pertenecen al cliente: se registran una sola vez y el sistema los reparte entre sus cargos, empezando por el más antiguo."
        actions={<RegisterPaymentModal clients={clients} />}
      />

      <KpiGrid>
        <Kpi label="Por verificar" value={pending.length} hint={pending.length ? money(pendingTotal) : 'Todo al día'} tone={pending.length ? 'warning' : 'success'} href="/pagos?vista=verificar" />
        <Kpi label="Por cobrar" value={money(receivable)} hint={`${invoices.length} factura(s) con saldo`} tone={receivable > 0 ? 'danger' : 'success'} href="/pagos?vista=cobrar" />
      </KpiGrid>

      <Tabs
        items={[
          { href: '/pagos?vista=verificar', label: 'Por verificar', count: pending.length, active: vista === 'verificar' },
          { href: '/pagos?vista=cobrar', label: 'Por cobrar', count: invoices.length, active: vista === 'cobrar' },
          { href: '/pagos?vista=historial', label: 'Historial', active: vista === 'historial' },
        ]}
      />

      {vista === 'verificar' && (
        <div className="stack">
          {pending.length === 0 && (
            <div className="glass-panel static"><Empty icon="✅" title="No hay comprobantes por verificar">Cuando un cliente suba un comprobante aparecerá aquí.</Empty></div>
          )}
          {pending.map((p) => {
            const target = p.targetInvoiceId ? targetById.get(p.targetInvoiceId) : null;
            const proof = p.proofUrl ? proofs.get(p.proofUrl) : null;
            return (
              <div key={p.id} className="glass-panel static panel">
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div className="stack-sm">
                    <div className="row">
                      <Link href={`/clientes/${p.client.id}`} className="link strong" style={{ fontSize: '1.05rem' }}>{p.client.name}</Link>
                      <span className="badge badge-accent mono">{p.client.code}</span>
                      <StatusBadge meta={PAYMENT_STATUS[p.status]} small />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{money(p.amount)}</div>
                    <div className="muted small">
                      {PAYMENT_METHOD_LABEL[p.method]} · fecha {shortDate(p.paidAt)}{p.reference ? ` · ref. ${p.reference}` : ''} · enviado {longDateTime(p.createdAt)}
                    </div>
                    <div className="small">
                      {target ? (
                        <>Para: <strong>{target.order ? `Pedido ${orderCode(target.order.number)}` : invoiceCode(target.number)}</strong></>
                      ) : (
                        <span className="muted">Sin factura indicada — se aplicará al saldo más antiguo</span>
                      )}
                    </div>
                    {p.note && <div className="muted small">“{p.note}”</div>}
                  </div>
                  <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                    {proof ? (
                      <a href={proof} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">📎 Ver comprobante</a>
                    ) : (
                      <span className="muted small">Sin comprobante adjunto</span>
                    )}
                    <PaymentReview paymentId={p.id} amount={p.amount} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === 'cobrar' && (
        <Panel flush>
          {invoices.length === 0 ? (
            <Empty icon="🎉" title="Nadie debe nada" />
          ) : (
            <div className="table-container" style={{ padding: '16px' }}>
              <table className="data-table compact">
                <thead>
                  <tr><th>CLIENTE</th><th>FACTURA</th><th>FECHA</th><th>CONCEPTO</th><th className="text-right">TOTAL</th><th className="text-right">PAGADO</th><th className="text-right">SALDO</th></tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/clientes/${i.client.id}/estado-de-cuenta`} className="link">{i.client.name}</Link> <span className="muted small mono">{i.client.code}</span></td>
                      <td className="mono">{invoiceCode(i.number)}</td>
                      <td>{shortDate(i.issueDate)}</td>
                      <td>{i.order ? <Link href={`/pedidos/${i.orderId}`} className="link">Pedido {orderCode(i.order.number)}</Link> : (i.description ?? INVOICE_TYPE[i.type])}</td>
                      <td className="text-right">{money(i.total)}</td>
                      <td className="text-right">{money(i.paidAmount)}</td>
                      <td className="text-right money-due">{money(i.total - i.paidAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {vista === 'historial' && (
        <Panel flush>
          {history.length === 0 ? (
            <Empty icon="🧾" title="Sin pagos registrados" />
          ) : (
            <div className="table-container" style={{ padding: '16px' }}>
              <table className="data-table compact">
                <thead>
                  <tr><th>FECHA</th><th>CLIENTE</th><th>MÉTODO</th><th>REFERENCIA</th><th className="text-right">MONTO</th><th>ESTADO</th><th>VERIFICÓ</th><th /></tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} style={p.status === 'APPROVED' ? undefined : { opacity: 0.65 }}>
                      <td className="nowrap">{shortDate(p.paidAt)}</td>
                      <td><Link href={`/clientes/${p.client.id}/estado-de-cuenta`} className="link">{p.client.name}</Link></td>
                      <td>{PAYMENT_METHOD_LABEL[p.method]}{p.kind === 'CREDIT_ADJUSTMENT' ? ` · ${p.note ?? ''}` : ''}</td>
                      <td className="mono small">{p.reference ?? '—'}</td>
                      <td className="text-right strong">{money(p.amount)}</td>
                      <td><StatusBadge meta={PAYMENT_STATUS[p.status]} small /></td>
                      <td className="small muted">{p.verifiedBy ?? '—'}</td>
                      <td>{user.role === 'ADMIN' && p.status === 'APPROVED' && <VoidPaymentButton paymentId={p.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
