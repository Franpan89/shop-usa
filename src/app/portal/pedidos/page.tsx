import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { ORDER_STATUS, ORDER_TYPE } from '@/lib/domain/flow';
import { invoiceBalanceOf, orderCode } from '@/lib/logistics';
import { Empty, StatusBadge, money, shortDate } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function PortalPedidos() {
  const me = await requirePortalClient();
  const orders = await prisma.order.findMany({
    where: { clientId: me.id },
    include: { invoice: { select: { total: true, paidAmount: true, status: true } }, products: { select: { id: true } } },
    orderBy: { number: 'desc' },
  });

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Mis pedidos</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>Personal Shopper y Compramos tu carrito.</p>
      {orders.length === 0 ? (
        <div className="glass-panel static"><Empty icon="🛒" title="Todavía no tienes pedidos" /></div>
      ) : (
        <div className="stack">
          {orders.map((o) => {
            const due = invoiceBalanceOf(o.invoice);
            return (
              <Link key={o.id} href={`/portal/pedidos/${o.id}`} className="glass-panel static panel" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="row-between">
                  <div className="row">
                    <strong className="mono">Pedido {orderCode(o.number)}</strong>
                    <span className="muted small">{ORDER_TYPE[o.type].icon} {ORDER_TYPE[o.type].label} · {shortDate(o.orderDate)} · {o.products.length} producto(s)</span>
                  </div>
                  <StatusBadge meta={ORDER_STATUS[o.status]} small />
                </div>
                <div className="row" style={{ marginTop: 10, gap: 24 }}>
                  <span>Total: <strong>{money(o.totalAmount)}</strong></span>
                  {o.status !== 'CANCELLED' && <span>Pendiente: <strong className={due > 0.004 ? 'money-due' : 'money-ok'}>{money(due)}</strong></span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
