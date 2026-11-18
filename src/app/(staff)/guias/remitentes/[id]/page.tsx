import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getCountryRules, getTenantId } from '@/lib/tenant';
import { ID_KIND, destinationLine, shipperIsIncomplete } from '@/lib/domain/guides';
import { Empty, PageHeader, Panel, ToneBadge } from '@/components/ui/kit';
import { ConsigneeForm } from '../../PartyForms';
import { ConsigneeRowActions } from '../PartyControls';

export const dynamic = 'force-dynamic';

export default async function ShipperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const tenantId = await getTenantId();

  const [shipper, rules] = await Promise.all([
    prisma.shipper.findFirst({
      where: { id, tenantId },
      include: { consignees: { include: { _count: { select: { guides: true } } }, orderBy: { name: 'asc' } } },
    }),
    getCountryRules(),
  ]);
  if (!shipper) notFound();

  const countries = rules.filter((r) => r.active).map((r) => r.name.toUpperCase());
  const details = [
    shipper.idNumber ? `${ID_KIND[shipper.idKind]} ${shipper.idNumber}` : null,
    [shipper.address, shipper.city, shipper.state].filter(Boolean).join(', ') || null,
    shipper.phone,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: '/guias/remitentes', label: 'Remitentes y destinatarios' }}
        eyebrow="Remitente"
        title={shipper.name}
        badges={
          <>
            <ToneBadge tone={shipper.active ? 'success' : 'secondary'}>{shipper.active ? 'Activo' : 'Inactivo'}</ToneBadge>
            {shipperIsIncomplete(shipper) && <ToneBadge tone="warning">Incompleto</ToneBadge>}
          </>
        }
        subtitle={details.join(' · ') || 'Sin datos de contacto'}
        actions={shipper.active ? <Link href={`/guias/nueva?remitente=${shipper.id}`} className="btn btn-mint">+ Crear guía</Link> : undefined}
      />

      <Panel title="Destinatarios" subtitle="Quienes reciben los envíos de este remitente." flush>
        <div className="table-container" style={{ marginTop: 12 }}>
          <table className="data-table compact">
            <thead>
              <tr><th>NOMBRE</th><th>IDENTIFICACIÓN</th><th>DESTINO</th><th>DIRECCIÓN</th><th>TELÉFONO</th><th>PARENTESCO</th><th>ESTADO</th><th /></tr>
            </thead>
            <tbody>
              {shipper.consignees.map((c) => (
                <tr key={c.id} style={c.active ? undefined : { opacity: 0.6 }}>
                  <td className="strong">{c.name}</td>
                  <td className="mono small">{c.idNumber ?? <span className="muted">—</span>}</td>
                  <td>{destinationLine(c) || <span className="muted">—</span>}</td>
                  <td className="small">
                    {c.declaredAddress ?? <span className="muted">—</span>}
                    {c.deliveryAddress && <div style={{ color: 'var(--color-slate)' }}>Entrega: {c.deliveryAddress}</div>}
                  </td>
                  <td className="mono small">{c.phone ?? <span className="muted">—</span>}</td>
                  <td>{c.relationship ?? <span className="muted">—</span>}</td>
                  <td><ToneBadge tone={c.active ? 'success' : 'secondary'} small>{c.active ? 'Activo' : 'Inactivo'}</ToneBadge></td>
                  <td>
                    <ConsigneeRowActions
                      shipperId={shipper.id}
                      countries={countries}
                      guideCount={c._count.guides}
                      consignee={{
                        id: c.id,
                        active: c.active,
                        name: c.name,
                        idKind: c.idKind,
                        idNumber: c.idNumber ?? '',
                        country: c.country,
                        province: c.province ?? '',
                        city: c.city ?? '',
                        declaredAddress: c.declaredAddress ?? '',
                        deliveryAddress: c.deliveryAddress ?? '',
                        reference: c.reference ?? '',
                        phone: c.phone ?? '',
                        relationship: c.relationship ?? '',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shipper.consignees.length === 0 && <Empty icon="📬" title="Este remitente todavía no tiene destinatarios">Agrega el primero en el formulario de abajo.</Empty>}
        </div>
      </Panel>

      <div style={{ marginTop: 24 }}>
        <Panel title="Nuevo destinatario">
          <ConsigneeForm shipperId={shipper.id} countries={countries} />
        </Panel>
      </div>
    </>
  );
}
