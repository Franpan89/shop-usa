import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { isDeliveryAuthorized } from '@/lib/domain/flow';
import { getCountryRuleMap, invoiceBalanceOf } from '@/lib/logistics';
import { Empty, PageHeader, Tabs, longDateTime, money, qty } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import Thumb from '@/components/ui/Thumb';
import { RegisterPaymentModal } from '@/components/finance/FinanceModals';
import { DeliverButton } from './DeliverButton';

import { nowMs } from '@/lib/clock';

export const dynamic = 'force-dynamic';

/** Autorización de entrega (7.11): la mercancía no se entrega mientras su factura de despacho tenga saldo. */
export default async function EntregasPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  await requireStaff();
  const { vista = 'retirar', q } = await searchParams;
  const tenantId = await getTenantId();
  const { ruleFor } = await getCountryRuleMap();

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      status: vista === 'entregados' ? 'DELIVERED' : 'READY_FOR_PICKUP',
      client: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } : undefined,
      deliveredAt: vista === 'entregados' ? { gte: new Date(nowMs() - 30 * 86_400_000) } : undefined,
    },
    include: {
      client: { select: { id: true, name: true, code: true, country: true, deliveryMethod: true, deliveryAddress: true } },
      consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true, id: true } } } },
    },
    orderBy: vista === 'entregados' ? { deliveredAt: 'desc' } : { destinationReceivedAt: 'asc' },
  });
  const readyCount = vista === 'retirar' ? products.length : await prisma.product.count({ where: { tenantId, status: 'READY_FOR_PICKUP' } });

  const groups = new Map<string, { client: (typeof products)[number]['client']; items: typeof products; balance: number; invoiceId: string | null }>();
  for (const p of products) {
    const g = groups.get(p.client.id) ?? { client: p.client, items: [], balance: 0, invoiceId: null };
    g.items.push(p);
    const b = invoiceBalanceOf(p.consolidation?.invoice);
    if (b > g.balance) { g.balance = b; g.invoiceId = p.consolidation?.invoice?.id ?? null; }
    groups.set(p.client.id, g);
  }

  return (
    <>
      <PageHeader title="Entregas" subtitle="Quién puede retirar su mercancía y quién no. El semáforo depende del saldo de la factura de despacho y de las reglas del país." />
      <Tabs items={[
        { href: '/entregas?vista=retirar', label: 'Listos para retirar', count: readyCount, active: vista === 'retirar' },
        { href: '/entregas?vista=entregados', label: 'Entregados (30 días)', active: vista === 'entregados' },
      ]} />
      <div className="filter-bar"><SearchFilter placeholder="Cliente o código…" /></div>

      {groups.size === 0 ? (
        <div className="glass-panel static"><Empty icon="🤝" title={vista === 'retirar' ? 'Nadie tiene mercancía lista para retirar' : 'Sin entregas recientes'} /></div>
      ) : (
        Array.from(groups.values()).map((g) => {
          const rule = ruleFor(g.client.country);
          // Autorización por producto: cada uno depende de la factura de SU despacho.
          const authorizedItems = g.items.filter((i) => isDeliveryAuthorized(invoiceBalanceOf(i.consolidation?.invoice), rule));
          const ok = authorizedItems.length === g.items.length;
          return (
            <div key={g.client.id} className="group-card">
              <div className="group-head">
                <div className="row">
                  <Link href={`/clientes/${g.client.id}`} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{g.client.name}</Link>
                  <span className="badge badge-accent mono badge-sm">{g.client.code}</span>
                  <span className="muted small">{g.client.country}{g.client.deliveryMethod === 'HOME_DELIVERY' ? ' · entrega a domicilio' : ''}</span>
                </div>
                {vista === 'retirar' && (
                  <div className="row">
                    <span className={`auth-pill ${ok ? 'ok' : 'no'}`}>
                      {ok ? '🟢 Autorizado para entrega' : authorizedItems.length > 0 ? `🟡 Parcial — saldo ${money(g.balance)} en parte de la mercancía` : `🔴 No entregar — saldo ${money(g.balance)}`}
                    </span>
                    {!ok && <RegisterPaymentModal clientId={g.client.id} invoices={g.invoiceId ? [{ id: g.invoiceId, label: 'Factura de despacho', balance: g.balance }] : []} defaultTargetId={g.invoiceId ?? ''} trigger="💳 Registrar pago" triggerClassName="btn btn-secondary btn-sm" />}
                    <DeliverButton productIds={authorizedItems.map((i) => i.id)} disabled={authorizedItems.length === 0} />
                  </div>
                )}
              </div>
              {g.items.map((p) => (
                <div key={p.id} className="group-row">
                  <Thumb src={p.imageUrl} alt={p.name} />
                  <div className="grow strong">{qty(p.name, p.quantity)}</div>
                  <span className="muted small">{vista === 'entregados' ? `Entregado ${longDateTime(p.deliveredAt)}` : `Llegó ${longDateTime(p.destinationReceivedAt)}`}</span>
                </div>
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
