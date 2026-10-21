import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { phonesMatch } from '@/lib/domain/access';
import { Alert, Empty, PageHeader, Panel, ToneBadge, longDateTime } from '@/components/ui/kit';
import { AccessActions } from './AccessControls';

export const dynamic = 'force-dynamic';

export default async function AccesosPage() {
  await requireStaff();
  const tenantId = await getTenantId();

  const [pending, decided] = await Promise.all([
    prisma.accessRequest.findMany({
      where: { tenantId, status: 'PENDING' },
      include: { client: { select: { id: true, code: true, name: true, phone: true, city: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.accessRequest.findMany({
      where: { tenantId, status: { not: 'PENDING' } },
      include: { client: { select: { id: true, code: true, name: true } } },
      orderBy: { decidedAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Accesos al portal"
        subtitle="Solicitudes de clientes que quieren entrar a su cuenta. Compara los datos antes de aprobar."
      />

      <Alert tone="info">
        Al aprobar, el correo queda ligado a ese código de cliente (un correo, un código) y se envía la invitación para crear la contraseña. El cliente solo verá su propia información.
      </Alert>

      <Panel title={`Pendientes (${pending.length})`} flush>
        {pending.length === 0 ? (
          <Empty icon="🔑" title="No hay solicitudes pendientes" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>TELÉFONO EN FICHA</th>
                <th>TELÉFONO QUE ESCRIBIÓ</th>
                <th>CORREO SOLICITADO</th>
                <th>FECHA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const match = phonesMatch(r.client.phone, r.phone);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/clientes/${r.client.id}`} style={{ fontWeight: 600 }}>{r.client.name}</Link>
                      <div className="muted small mono">{r.client.code}{r.client.city ? ` · ${r.client.city}` : ''}</div>
                    </td>
                    <td>{r.client.phone || <span className="muted">Sin teléfono</span>}</td>
                    <td>
                      {r.phone}{' '}
                      {r.client.phone ? (
                        <ToneBadge tone={match ? 'success' : 'warning'} small>{match ? 'Coincide' : 'No coincide'}</ToneBadge>
                      ) : null}
                    </td>
                    <td>{r.email}</td>
                    <td className="muted small">{longDateTime(r.createdAt)}</td>
                    <td><AccessActions id={r.id} email={r.email} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {decided.length > 0 && (
        <Panel title="Atendidas recientemente" flush>
          <table className="data-table">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>CORREO</th>
                <th>RESULTADO</th>
                <th>POR</th>
                <th>FECHA</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/clientes/${r.client.id}`}>{r.client.name}</Link> <span className="muted small mono">{r.client.code}</span>
                  </td>
                  <td>{r.email}</td>
                  <td>
                    <ToneBadge tone={r.status === 'APPROVED' ? 'success' : 'danger'} small>{r.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}</ToneBadge>
                    {r.rejectReason ? <div className="muted small">{r.rejectReason}</div> : null}
                  </td>
                  <td className="muted small">{r.decidedBy ?? '—'}</td>
                  <td className="muted small">{longDateTime(r.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
