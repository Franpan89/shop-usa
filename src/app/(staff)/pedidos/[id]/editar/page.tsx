import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/tenant';
import { PRODUCT_STATUS_RANK } from '@/lib/domain/flow';
import { orderCode } from '@/lib/logistics';
import { PageHeader } from '@/components/ui/kit';
import OrderForm from '../../OrderForm';

export const dynamic = 'force-dynamic';

export default async function EditarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { client: { include: { shippingCategory: { select: { name: true } } } }, products: true },
  });
  if (!order) notFound();
  const locked = order.cancelledAt || order.products.some((p) => PRODUCT_STATUS_RANK[p.status] >= PRODUCT_STATUS_RANK.PURCHASED);
  if (locked) redirect(`/pedidos/${id}`);

  const settings = await getSettings();
  const catalog = await prisma.productCatalog.findMany({ where: { tenantId: order.tenantId }, orderBy: [{ timesShipped: 'desc' }, { name: 'asc' }], take: 300 });

  return (
    <>
      <PageHeader back={{ href: `/pedidos/${id}`, label: `Pedido ${orderCode(order.number)}` }} title={`Editar pedido ${orderCode(order.number)}`} subtitle={`${order.client.name} · ${order.client.code}`} />
      <OrderForm
        clients={[{ id: order.client.id, name: order.client.name, code: order.client.code, country: order.client.country, serviceFeePercent: order.client.serviceFeePercent, shippingCategoryName: order.client.shippingCategory?.name ?? null, availableBenefits: 0 }]}
        catalog={catalog.map((c) => ({ name: c.name, price: c.defaultPurchaseValue }))}
        settings={{ taxRatePercent: order.taxRatePercent, cartServiceRatePercent: settings.cartServiceRatePercent, referralDiscountPoints: settings.referralDiscountPoints }}
        initial={{
          orderId: order.id,
          clientId: order.clientId,
          type: order.type,
          serviceRate: order.serviceFeePercent,
          items: order.products.map((p) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice ?? 0, storeName: p.storeName ?? '', url: p.url ?? '', variant: p.variant ?? '', notes: p.notes ?? '', imageUrl: p.imageUrl ?? '' })),
          discount: order.discountType && order.discountValue ? { type: order.discountType, value: order.discountValue, reason: order.discountReason ?? 'Ajuste' } : null,
          extraCharges: order.extraCharges,
          extraChargesNote: order.extraChargesNote ?? '',
          notes: order.notes ?? '',
          channel: order.channel ?? 'WhatsApp',
        }}
      />
    </>
  );
}
