import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import SearchFilter from '@/components/SearchFilter';
import { PageHeader, shortDate } from '@/components/ui/kit';
import CatalogManager from './CatalogManager';

export const dynamic = 'force-dynamic';

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q } = await searchParams;
  const tenantId = await getTenantId();
  const rows = await prisma.productCatalog.findMany({
    where: { tenantId, name: q ? { contains: q, mode: 'insensitive' } : undefined },
    orderBy: [{ timesShipped: 'desc' }, { name: 'asc' }],
    take: 300,
  });

  return (
    <>
      <PageHeader title="Catálogo" subtitle="Productos frecuentes: al crear un pedido se autocompleta el nombre y el precio habitual." />
      <div className="filter-bar"><SearchFilter placeholder="Buscar producto…" /></div>
      <CatalogManager rows={rows.map((r) => ({ id: r.id, name: r.name, price: r.defaultPurchaseValue, notes: r.notes, uses: r.timesShipped, lastUsed: r.lastUsedAt ? shortDate(r.lastUsedAt) : null }))} />
    </>
  );
}
