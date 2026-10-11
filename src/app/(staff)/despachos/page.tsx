import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { dispatchCode, getCountryRuleMap } from '@/lib/logistics';
import { Empty, PageHeader, ToneBadge, shortDate } from '@/components/ui/kit';
import { NewDispatchButton } from './DispatchControls';

export const dynamic = 'force-dynamic';

export default async function DespachosPage() {
  await requireStaff();
  const tenantId = await getTenantId();
  const { rules } = await getCountryRuleMap();

  const dispatches = await prisma.dispatch.findMany({
    where: { tenantId },
    include: { pkgs: { include: { products: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } } } } },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Despachos"
        subtitle="Un despacho es el evento en que uno o varios PKG salen hacia un destino. Tú decides qué PKG van en cada uno."
        actions={<NewDispatchButton countries={rules.filter((r) => r.active).map((r) => r.name)} />}
      />
      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead><tr><th>DESPACHO</th><th>DESTINO</th><th>FECHA</th><th>PKG</th><th>UNIDADES</th><th>ESTADO</th><th /></tr></thead>
          <tbody>
            {dispatches.map((d) => (
              <tr key={d.id}>
                <td><Link href={`/despachos/${d.id}`} className="link mono strong">{dispatchCode(d.number)}</Link></td>
                <td>{d.country}</td>
                <td>{shortDate(d.date)}</td>
                <td>{d.pkgs.length}</td>
                <td>{d.pkgs.reduce((s, p) => s + p.products.reduce((x, y) => x + y.quantity, 0), 0)}</td>
                <td>{d.status === 'CONFIRMED' ? <ToneBadge tone="success" small>Salió {shortDate(d.confirmedAt)}</ToneBadge> : <ToneBadge tone="warning" small>Borrador</ToneBadge>}</td>
                <td><Link href={`/despachos/${d.id}`} className="btn btn-secondary btn-sm">Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dispatches.length === 0 && <Empty icon="🚚" title="Todavía no hay despachos">Crea uno y agrega los PKG que van a salir.</Empty>}
      </div>
    </>
  );
}
