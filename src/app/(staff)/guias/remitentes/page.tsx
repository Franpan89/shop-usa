import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { ID_KIND, shipperIsIncomplete } from '@/lib/domain/guides';
import { Empty, PageHeader, Panel, ToneBadge } from '@/components/ui/kit';
import SearchFilter from '@/components/SearchFilter';
import CheckFilter from '@/components/CheckFilter';
import { peekRefNumbers } from '@/lib/guides';
import { guideRef } from '@/lib/domain/guides';
import { ShipperForm } from '../PartyForms';
import IdentifierForm from '../IdentifierForm';
import { ShipperRowActions } from './PartyControls';
import { IdentifierRowActions } from './IdentifierControls';

export const dynamic = 'force-dynamic';

const LIMIT = 500;

export default async function RemitentesPage({ searchParams }: { searchParams: Promise<{ q?: string; incompletos?: string }> }) {
  await requireStaff();
  const { q, incompletos } = await searchParams;
  const tenantId = await getTenantId();
  const term = q?.trim();

  const shippers = await prisma.shipper.findMany({
    where: {
      tenantId,
      OR: term
        ? [
            { name: { contains: term, mode: 'insensitive' } },
            { idNumber: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { city: { contains: term, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: { _count: { select: { consignees: true, guides: true } } },
    orderBy: { name: 'asc' },
    take: LIMIT,
  });
  const rows = incompletos === '1' ? shippers.filter(shipperIsIncomplete) : shippers;

  const identifiers = await prisma.guideIdentifier.findMany({ where: { tenantId }, orderBy: { prefix: 'asc' } });
  const [usage, nextRefs] = await Promise.all([
    prisma.guide.groupBy({ by: ['refPrefix'], where: { tenantId, refPrefix: { not: null } }, _count: { _all: true } }),
    peekRefNumbers(prisma, tenantId, identifiers.map((i) => i.prefix)),
  ]);
  const usedBy = new Map(usage.map((u) => [u.refPrefix, u._count._all]));

  return (
    <>
      <PageHeader
        eyebrow="Guías"
        title="Remitentes y destinatarios"
        subtitle="Cada destinatario pertenece a un remitente. Los datos completos evitan errores en el manifiesto aduanero."
      />

      <Panel title="Nuevo remitente (quien envía desde Estados Unidos)">
        <ShipperForm />
      </Panel>

      <div className="row-between" style={{ marginTop: 28, marginBottom: 12 }}>
        <h2 className="panel-title">Remitentes</h2>
      </div>
      <div className="filter-bar">
        <SearchFilter placeholder="Buscar por nombre, cédula, ciudad o teléfono…" />
        <CheckFilter label="Solo los incompletos" paramName="incompletos" />
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr><th>NOMBRE</th><th>IDENTIFICACIÓN</th><th>CIUDAD</th><th>TELÉFONO</th><th>DESTINATARIOS</th><th>ESTADO</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const incomplete = shipperIsIncomplete(s);
              return (
                <tr key={s.id} style={s.active ? undefined : { opacity: 0.6 }}>
                  <td className="strong">{s.name}</td>
                  <td className="mono small">{s.idNumber ?? <span className="muted">—</span>}</td>
                  <td>{[s.city, s.state].filter(Boolean).join(' ') || <span className="muted">—</span>}</td>
                  <td className="mono small">{s.phone ?? <span className="muted">—</span>}</td>
                  <td>{s._count.consignees}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <ToneBadge tone={s.active ? 'success' : 'secondary'} small>{s.active ? 'Activo' : 'Inactivo'}</ToneBadge>
                      {incomplete && <ToneBadge tone="warning" small>Incompleto</ToneBadge>}
                    </div>
                  </td>
                  <td>
                    <ShipperRowActions
                      guideCount={s._count.guides}
                      shipper={{
                        id: s.id,
                        active: s.active,
                        name: s.name,
                        idKind: s.idKind,
                        idNumber: s.idNumber ?? '',
                        address: s.address ?? '',
                        city: s.city ?? '',
                        state: s.state ?? '',
                        phone: s.phone ?? '',
                        email: s.email ?? '',
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty icon="👥" title={term || incompletos ? 'No hay remitentes con esos filtros' : 'Todavía no hay remitentes'}>
            Guarda el primero en el formulario de arriba.
          </Empty>
        )}
      </div>
      <div className="row-between" style={{ marginTop: 36, marginBottom: 12 }}>
        <h2 className="panel-title">Identificadores de paquete</h2>
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Toda guía sale como IFLWH00XXX, sin importar el identificador. El identificador es el tracking que va impreso en la etiqueta:
        PKG501 (la caja donde viaja) o el de otro identificador, como JM001 (el primer paquete de “JM”).
      </p>
      <div className="glass-panel static table-container" style={{ marginBottom: 16 }}>
        <table className="data-table compact">
          <thead>
            <tr><th>IDENTIFICADOR</th><th>DESCRIPCIÓN</th><th>GUÍAS</th><th>PRÓXIMO</th><th>ESTADO</th><th /></tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono strong">PKG</td>
              <td className="muted">El número de la caja; se escribe al crear la guía</td>
              <td>{usedBy.get('PKG') ?? 0}</td>
              <td className="muted">—</td>
              <td><ToneBadge tone="success" small>Fijo</ToneBadge></td>
              <td />
            </tr>
            {identifiers.map((i) => (
              <tr key={i.id} style={i.active ? undefined : { opacity: 0.6 }}>
                <td className="mono strong">{i.prefix}</td>
                <td>{i.description ?? <span className="muted">—</span>}</td>
                <td>{usedBy.get(i.prefix) ?? 0}</td>
                <td className="mono">{guideRef(i.prefix, nextRefs[i.prefix] ?? 1)}</td>
                <td><ToneBadge tone={i.active ? 'success' : 'secondary'} small>{i.active ? 'Activo' : 'Inactivo'}</ToneBadge></td>
                <td><IdentifierRowActions id={i.id} prefix={i.prefix} active={i.active} used={usedBy.get(i.prefix) ?? 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title="Nuevo identificador">
        <IdentifierForm />
      </Panel>

      <p className="muted small" style={{ marginTop: 10 }}>Tipos de identificación: {Object.values(ID_KIND).join(', ')}.</p>
    </>
  );
}
