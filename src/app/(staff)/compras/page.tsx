import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { orderCode } from '@/lib/logistics';
import { ORDER_TYPE } from '@/lib/domain/flow';
import { Alert, Empty, PageHeader, Tabs } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import PurchaseList, { type PurchaseGroup } from './PurchaseList';

export const dynamic = 'force-dynamic';

/**
 * Control de compra (2.10): solo los productos de pedidos con pago aprobado aparecen como
 * LISTOS PARA COMPRAR. Cada producto se marca como comprado por separado.
 */
export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  await requireStaff();
  const { vista = 'listos', q } = await searchParams;
  const tenantId = await getTenantId();

  const status = vista === 'bloqueados' ? 'PENDING_PAYMENT' : 'READY_TO_BUY';
  const [products, readyCount, blockedCount] = await Promise.all([
    prisma.product.findMany({
      where: {
        tenantId,
        status,
        order: { isNot: null },
        OR: q
          ? [
              { name: { contains: q, mode: 'insensitive' } },
              { storeName: { contains: q, mode: 'insensitive' } },
              { client: { name: { contains: q, mode: 'insensitive' } } },
              { client: { code: { contains: q, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: {
        client: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, number: true, type: true, courtesyAuthorized: true, invoice: { select: { total: true, paidAmount: true } } } },
      },
      orderBy: [{ order: { number: 'asc' } }, { createdAt: 'asc' }],
    }),
    prisma.product.count({ where: { tenantId, status: 'READY_TO_BUY' } }),
    prisma.product.count({ where: { tenantId, status: 'PENDING_PAYMENT', order: { isNot: null } } }),
  ]);

  const byOrder = new Map<string, PurchaseGroup>();
  for (const p of products) {
    if (!p.order) continue;
    if (!byOrder.has(p.order.id)) {
      const inv = p.order.invoice;
      byOrder.set(p.order.id, {
        orderId: p.order.id,
        orderCode: orderCode(p.order.number),
        typeLabel: `${ORDER_TYPE[p.order.type].icon} ${ORDER_TYPE[p.order.type].short}`,
        clientId: p.client.id,
        clientName: p.client.name,
        clientCode: p.client.code,
        payment: p.order.courtesyAuthorized && inv && inv.total - inv.paidAmount > 0.004 ? 'courtesy' : status === 'READY_TO_BUY' ? 'paid' : 'unpaid',
        items: [],
      });
    }
    byOrder.get(p.order.id)!.items.push({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      unitPrice: p.unitPrice ?? 0,
      imageUrl: p.imageUrl,
      storeName: p.storeName,
      url: p.url,
      variant: p.variant,
      notes: p.notes,
    });
  }

  return (
    <>
      <PageHeader title="Compras" subtitle="Lo que Shop USA puede comprar hoy: solo productos de pedidos con el pago aprobado." />
      <Tabs
        items={[
          { href: '/compras?vista=listos', label: 'Listos para comprar', count: readyCount, active: vista === 'listos' },
          { href: '/compras?vista=bloqueados', label: 'Pendientes de pago', count: blockedCount, active: vista === 'bloqueados' },
        ]}
      />
      <div className="filter-bar"><SearchFilter placeholder="Producto, tienda, cliente o código…" /></div>

      {vista === 'bloqueados' && <Alert tone="warning">Estos productos <strong>no se deben comprar</strong>: el pedido todavía no tiene el pago aprobado. Shop USA no adelanta dinero.</Alert>}

      {byOrder.size === 0 ? (
        <div className="glass-panel static">
          <Empty icon={vista === 'listos' ? '🛍️' : '✅'} title={vista === 'listos' ? 'No hay productos listos para comprar' : 'No hay productos esperando pago'}>
            {vista === 'listos' ? <>Cuando se apruebe el pago de un pedido, sus productos aparecerán aquí. <Link href="/pagos" className="link">Ir a verificar pagos</Link></> : null}
          </Empty>
        </div>
      ) : (
        <PurchaseList groups={Array.from(byOrder.values())} selectable={vista === 'listos'} />
      )}
    </>
  );
}
