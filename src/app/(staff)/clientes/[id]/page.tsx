import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getClientAccount } from '@/lib/accounting';
import { getCountryRules, getSettings } from '@/lib/tenant';
import { estimateShipping } from '@/lib/consolidation';
import { consolidationLabel, ORDER_STATUS, ORDER_TYPE, ORIGIN, PRODUCT_STATUS, retentionDays } from '@/lib/domain/flow';
import { invoiceBalanceOf, invoiceCode, orderCode } from '@/lib/logistics';
import { Alert, Empty, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, ToneBadge, money, shortDate, qty } from '@/components/ui/kit';
import { CreditModal, ManualChargeModal, RegisterPaymentModal } from '@/components/finance/FinanceModals';
import Thumb from '@/components/ui/Thumb';
import ClientForm from '../ClientForm';
import { CustodyToggle, InvitePortalButton } from '../ClientPanels';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  await requireStaff();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      shippingCategory: true,
      referredBy: { select: { id: true, name: true, code: true } },
      referrals: { select: { id: true, name: true, code: true, referralBenefitGenerated: { select: { status: true } } } },
      referralBenefitGenerated: { select: { id: true } },
    },
  });
  if (!client) notFound();

  const [account, categories, rules, settings, everyone, orders, benefits, consolidation, products, openInvoices, custody] = await Promise.all([
    getClientAccount(prisma, id),
    prisma.shippingCategory.findMany({ where: { tenantId: client.tenantId }, orderBy: [{ country: 'asc' }, { name: 'asc' }] }),
    getCountryRules(),
    getSettings(),
    prisma.client.findMany({ where: { tenantId: client.tenantId }, select: { id: true, name: true, code: true, country: true }, orderBy: { name: 'asc' } }),
    prisma.order.findMany({ where: { clientId: id }, orderBy: { orderDate: 'desc' }, take: 8, include: { invoice: { select: { total: true, paidAmount: true, status: true } } } }),
    prisma.referralBenefit.findMany({
      where: { referrerId: id },
      orderBy: { createdAt: 'desc' },
      include: { referred: { select: { name: true, code: true } }, usedOrder: { select: { number: true } } },
    }),
    prisma.consolidation.findFirst({
      where: { clientId: id, status: 'OPEN' },
      include: { products: { where: { status: { not: 'CANCELLED' } }, select: { id: true, name: true, quantity: true, imageUrl: true, origin: true } } },
    }),
    prisma.product.findMany({
      where: { clientId: id, status: { notIn: ['CANCELLED', 'DELIVERED'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.invoice.findMany({
      where: { clientId: id, status: { in: ['PENDING', 'PARTIAL'] } },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    }),
    prisma.custodyPackage.findMany({ where: { clientId: id }, orderBy: { receivedAt: 'desc' }, take: 10 }),
  ]);

  const available = benefits.filter((b) => b.status === 'AVAILABLE').length;
  const estimate = consolidation ? estimateShipping(consolidation.realWeight, client.shippingCategory) : null;
  const days = consolidation?.decision === 'HOLD' ? retentionDays(consolidation.retentionStartedAt) : 0;
  const countries = rules.filter((r) => r.active).map((r) => r.name);

  const b = client.birthday;
  const formValues = {
    id: client.id,
    code: client.code,
    name: client.name,
    idNumber: client.idNumber,
    email: client.email,
    phone: client.phone,
    country: client.country,
    city: client.city,
    deliveryMethod: client.deliveryMethod,
    deliveryAddress: client.deliveryAddress,
    serviceFeePercent: client.serviceFeePercent,
    shippingCategoryId: client.shippingCategoryId,
    referredById: client.referredById,
    birthdayMonth: b ? b.getUTCMonth() + 1 : null,
    birthdayDay: b ? b.getUTCDate() : null,
    notes: client.notes,
    referralLocked: !!client.referralBenefitGenerated,
  };

  return (
    <>
      <PageHeader
        back={{ href: '/clientes', label: 'Clientes' }}
        title={client.name}
        badges={<span className="badge badge-accent mono">{client.code}</span>}
        subtitle={`${client.city ? `${client.city}, ` : ''}${client.country} · ${client.phone}${client.email ? ` · ${client.email}` : ''} · Cliente desde ${shortDate(client.createdAt)}`}
        actions={
          <>
            <Link href={`/pedidos/nuevo?clientId=${id}`} className="btn">🛒 Nuevo pedido</Link>
            <Link href={`/clientes/${id}/estado-de-cuenta`} className="btn btn-secondary">📋 Estado de cuenta</Link>
            <InvitePortalButton clientId={id} hasEmail={!!client.email} />
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Saldo pendiente" value={money(account.pending)} tone={account.pending > 0.004 ? 'danger' : 'success'} hint={account.pending > 0.004 ? 'Debe a Shop USA' : 'Al día'} />
        <Kpi label="Saldo a favor" value={money(account.credit)} tone={account.credit > 0.004 ? 'success' : undefined} hint="Se usa solo en el próximo cargo" />
        <Kpi label="Beneficios por referidos" value={available} tone={available > 0 ? 'accent' : undefined} hint={`−${settings.referralDiscountPoints} pts de servicio por factura`} />
        <Kpi
          label="Consolidado abierto"
          value={consolidation ? `${consolidation.products.length} prod.` : '—'}
          hint={consolidation ? `${consolidation.realWeight.toFixed(2)} lb${estimate?.cost != null ? ` · est. ${money(estimate.cost)}` : ''}` : 'Sin mercancía en bodega'}
          href={consolidation ? `/consolidados/${consolidation.id}` : undefined}
        />
      </KpiGrid>

      {!client.shippingCategory && <Alert tone="warning">Este cliente no tiene tarifa de envío asignada: no se podrá cerrar su consolidado ni calcular su envío. Asígnala en la ficha.</Alert>}

      <div className="page-grid">
        <div className="stack">
          <Panel title="Ficha del cliente" subtitle="El código es permanente; el resto de datos y condiciones se puede ajustar.">
            <ClientForm
              client={formValues}
              categories={categories.map((c) => ({ id: c.id, name: c.name, country: c.country, pricePerLb: c.pricePerLb, unit: c.unit, active: c.active }))}
              countries={countries}
              referrers={everyone}
              defaultServiceFee={settings.personalShopperRatePercent}
            />
          </Panel>

          <Panel title="Pedidos recientes" actions={<Link href={`/pedidos?clientId=${id}`} className="link small">Ver todos</Link>} flush>
            {orders.length === 0 ? (
              <Empty icon="🛒" title="Sin pedidos todavía" />
            ) : (
              <div className="table-container" style={{ padding: '0 16px 16px' }}>
                <table className="data-table compact">
                  <thead>
                    <tr><th>#</th><th>TIPO</th><th>FECHA</th><th>ESTADO</th><th className="text-right">TOTAL</th><th className="text-right">PENDIENTE</th></tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/pedidos/${o.id}`} className="link mono">{orderCode(o.number)}</Link></td>
                        <td>{ORDER_TYPE[o.type].icon} {ORDER_TYPE[o.type].short}</td>
                        <td>{shortDate(o.orderDate)}</td>
                        <td><StatusBadge meta={ORDER_STATUS[o.status]} small /></td>
                        <td className="text-right">{money(o.totalAmount)}</td>
                        <td className="text-right">{invoiceBalanceOf(o.invoice) > 0 ? <span className="money-due">{money(invoiceBalanceOf(o.invoice))}</span> : <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Productos en curso" subtitle="Todo lo que este cliente tiene en el sistema y aún no fue entregado.">
            {products.length === 0 ? (
              <Empty icon="📦" title="Sin productos en curso" />
            ) : (
              <div className="stack-sm">
                {products.map((p) => (
                  <div key={p.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                      <Thumb src={p.imageUrl} alt={p.name} />
                      <div style={{ minWidth: 0 }}>
                        <div className="strong">{qty(p.name, p.quantity)}</div>
                        <div className="muted small">{ORIGIN[p.origin].icon} {ORIGIN[p.origin].label}</div>
                      </div>
                    </div>
                    <StatusBadge meta={PRODUCT_STATUS[p.status]} small />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Cuenta corriente">
            <div className="stack-sm">
              <div className="row">
                <RegisterPaymentModal
                  clientId={id}
                  invoices={openInvoices.map((i) => ({ id: i.id, label: `${invoiceCode(i.number)} — ${i.description ?? ''}`, balance: i.total - i.paidAmount }))}
                  trigger="💳 Registrar pago"
                />
                <ManualChargeModal clientId={id} taxRate={settings.taxRatePercent} serviceRate={client.serviceFeePercent} />
                <CreditModal clientId={id} />
              </div>
              <Link href={`/clientes/${id}/estado-de-cuenta`} className="link small">Ver estado de cuenta completo →</Link>
            </div>
          </Panel>

          <Panel title="Referidos" subtitle={`Cada referido que complete su primera compra válida da 1 beneficio: −${settings.referralDiscountPoints} puntos en la tasa de UNA factura.`}>
            <div className="stack-sm">
              <div>
                <span className="muted small">Referido por: </span>
                {client.referredBy ? <Link href={`/clientes/${client.referredBy.id}`} className="link">{client.referredBy.name} ({client.referredBy.code})</Link> : <span className="muted">—</span>}
              </div>
              <div>
                <span className="muted small">Tasa habitual: </span><strong>{client.serviceFeePercent}%</strong>
                <span className="muted small"> · Beneficios disponibles: </span><strong>{available}</strong>
              </div>
              {client.referrals.length > 0 && (
                <div className="muted small">
                  Ha referido a: {client.referrals.map((r) => `${r.name} (${r.referralBenefitGenerated ? 'compró' : 'aún sin compra'})`).join(', ')}
                </div>
              )}
              {benefits.length > 0 && (
                <div className="table-container">
                  <table className="data-table compact" style={{ fontSize: '0.82rem' }}>
                    <thead><tr><th>REFERIDO</th><th>GENERADO</th><th>ESTADO</th><th>USADO EN</th></tr></thead>
                    <tbody>
                      {benefits.map((bf) => (
                        <tr key={bf.id}>
                          <td>{bf.referred.name}</td>
                          <td>{shortDate(bf.createdAt)}</td>
                          <td>
                            <ToneBadge tone={bf.status === 'AVAILABLE' ? 'success' : bf.status === 'USED' ? 'secondary' : 'danger'} small>
                              {bf.status === 'AVAILABLE' ? 'Disponible' : bf.status === 'USED' ? 'Utilizado' : 'Anulado'}
                            </ToneBadge>
                          </td>
                          <td>{bf.usedOrder ? `${orderCode(bf.usedOrder.number)} · ${shortDate(bf.usedAt)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>

          {consolidation && (
            <Panel title="Consolidado abierto" actions={<Link href={`/consolidados/${consolidation.id}`} className="link small">Abrir →</Link>}>
              <div className="stack-sm">
                <StatusBadge meta={consolidationLabel(consolidation.status, consolidation.decision)} />
                {consolidation.decision === 'HOLD' && <div className="muted small">Retenido hace {days} día(s) · desde {shortDate(consolidation.retentionStartedAt)}</div>}
                <div className="muted small">
                  {consolidation.products.length} producto(s) · {consolidation.realWeight.toFixed(2)} lb reales
                  {estimate?.cost != null ? ` · ${estimate.billableWeight} lb facturables · ${money(estimate.cost)}` : ''}
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Custodio de paquetería" subtitle="Servicio para turistas que viajan a Orlando. Apagado por defecto.">
            <CustodyToggle clientId={id} active={client.custodyActive} deadline={client.custodyDeadline ? client.custodyDeadline.toISOString().slice(0, 10) : null} />
            {custody.length > 0 && (
              <div className="muted small" style={{ marginTop: 12 }}>
                {custody.filter((p) => p.status === 'IN_CUSTODY').length} paquete(s) en custodia ·{' '}
                <Link href="/custodio" className="link">ver módulo</Link>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
