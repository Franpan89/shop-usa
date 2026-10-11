import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings, getTenantId } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/kit';
import OrderForm from '../OrderForm';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ clientId?: string; tipo?: string }>;
}

export default async function NuevoPedidoPage({ searchParams }: Props) {
  await requireStaff();
  const { clientId } = await searchParams;
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const [clients, catalog, benefits] = await Promise.all([
    prisma.client.findMany({
      where: { tenantId },
      include: { shippingCategory: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.productCatalog.findMany({ where: { tenantId }, orderBy: [{ timesShipped: 'desc' }, { name: 'asc' }], take: 300 }),
    prisma.referralBenefit.groupBy({ by: ['referrerId'], where: { status: 'AVAILABLE' }, _count: true }),
  ]);
  const benefitsBy = new Map(benefits.map((b) => [b.referrerId, b._count]));

  return (
    <>
      <PageHeader back={{ href: '/pedidos', label: 'Pedidos' }} title="Nuevo pedido" subtitle="El cliente y sus condiciones comerciales se cargan solos; tú solo registras los productos." />
      <OrderForm
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          country: c.country,
          serviceFeePercent: c.serviceFeePercent,
          shippingCategoryName: c.shippingCategory?.name ?? null,
          availableBenefits: benefitsBy.get(c.id) ?? 0,
        }))}
        catalog={catalog.map((c) => ({ name: c.name, price: c.defaultPurchaseValue }))}
        settings={{ taxRatePercent: settings.taxRatePercent, cartServiceRatePercent: settings.cartServiceRatePercent, referralDiscountPoints: settings.referralDiscountPoints }}
        initialClientId={clientId}
      />
    </>
  );
}
