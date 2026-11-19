import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getCountryRules, getTenantId } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/kit';
import { peekRefNumbers } from '@/lib/guides';
import CreateGuideForm from './CreateGuideForm';

export const dynamic = 'force-dynamic';

export default async function CrearGuiaPage({ searchParams }: { searchParams: Promise<{ remitente?: string }> }) {
  await requireStaff();
  const { remitente } = await searchParams;
  const tenantId = await getTenantId();

  const [shippers, consignees, rules, identifiers, pkgs] = await Promise.all([
    prisma.shipper.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, idNumber: true, city: true } }),
    prisma.consignee.findMany({
      where: { tenantId, active: true, shipper: { active: true } },
      orderBy: { name: 'asc' },
      select: { id: true, shipperId: true, name: true, idNumber: true, city: true },
    }),
    getCountryRules(),
    prisma.guideIdentifier.findMany({ where: { tenantId, active: true }, orderBy: { prefix: 'asc' }, select: { prefix: true, description: true } }),
    // Los PKG más recientes: sugeridos al escribir el número de la caja.
    prisma.pkg.findMany({ where: { tenantId }, orderBy: { number: 'desc' }, take: 40, select: { number: true } }),
  ]);
  const nextRefs = await peekRefNumbers(prisma, tenantId, identifiers.map((i) => i.prefix));

  return (
    <>
      <PageHeader
        eyebrow="Guías"
        title="Crear guía"
        subtitle="Elige quién envía y quién recibe, indica el PKG (o identificador) y la etiqueta 4 × 6 sale lista para la impresora térmica."
      />
      <CreateGuideForm
        shippers={shippers}
        consignees={consignees}
        countries={rules.filter((r) => r.active).map((r) => r.name.toUpperCase())}
        initialShipperId={shippers.find((s) => s.id === remitente)?.id ?? ''}
        identifiers={identifiers.map((i) => ({ prefix: i.prefix, description: i.description ?? '', next: nextRefs[i.prefix] ?? 1 }))}
        pkgNumbers={pkgs.map((p) => p.number)}
      />
    </>
  );
}
