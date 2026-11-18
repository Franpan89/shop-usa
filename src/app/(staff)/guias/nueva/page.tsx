import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getCountryRules, getTenantId } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/kit';
import CreateGuideForm from './CreateGuideForm';

export const dynamic = 'force-dynamic';

export default async function CrearGuiaPage({ searchParams }: { searchParams: Promise<{ remitente?: string }> }) {
  await requireStaff();
  const { remitente } = await searchParams;
  const tenantId = await getTenantId();

  const [shippers, consignees, rules] = await Promise.all([
    prisma.shipper.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, idNumber: true, city: true } }),
    prisma.consignee.findMany({
      where: { tenantId, active: true, shipper: { active: true } },
      orderBy: { name: 'asc' },
      select: { id: true, shipperId: true, name: true, idNumber: true, city: true },
    }),
    getCountryRules(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Guías"
        title="Crear guía"
        subtitle="Elige quién envía y quién recibe, completa el paquete y la etiqueta 4 × 6 sale lista para la impresora térmica."
      />
      <CreateGuideForm
        shippers={shippers}
        consignees={consignees}
        countries={rules.filter((r) => r.active).map((r) => r.name.toUpperCase())}
        initialShipperId={shippers.find((s) => s.id === remitente)?.id ?? ''}
      />
    </>
  );
}
