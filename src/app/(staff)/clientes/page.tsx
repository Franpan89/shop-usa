import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getAccountsByClient } from '@/lib/accounting';
import { getCountryRules, getSettings, getTenantId } from '@/lib/tenant';
import SearchFilter from '@/components/SearchFilter';
import SelectFilter from '@/components/SelectFilter';
import { Empty, PageHeader, ToneBadge, money } from '@/components/ui/kit';
import NewClientModal from './NewClientModal';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; saldo?: string; pais?: string; custodio?: string }>;
}

export default async function ClientesPage({ searchParams }: Props) {
  await requireStaff();
  const { q, saldo, pais, custodio } = await searchParams;
  const tenantId = await getTenantId();

  const [allClients, categories, rules, settings, benefits] = await Promise.all([
    prisma.client.findMany({
      where: {
        tenantId,
        country: pais || undefined,
        custodyActive: custodio ? true : undefined,
        OR: q
          ? [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { idNumber: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { shippingCategory: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shippingCategory.findMany({ where: { tenantId }, orderBy: [{ country: 'asc' }, { name: 'asc' }] }),
    getCountryRules(),
    getSettings(),
    prisma.referralBenefit.groupBy({ by: ['referrerId'], where: { status: 'AVAILABLE' }, _count: true }),
  ]);

  const accounts = await getAccountsByClient(prisma, allClients.map((c) => c.id));
  const benefitsBy = new Map(benefits.map((b) => [b.referrerId, b._count]));

  const clients = allClients.filter((c) => {
    const acc = accounts.get(c.id);
    if (saldo === 'deuda') return (acc?.pending ?? 0) > 0.004;
    if (saldo === 'favor') return (acc?.credit ?? 0) > 0.004;
    if (saldo === 'aldia') return (acc?.pending ?? 0) <= 0.004;
    return true;
  });

  const everyone = await prisma.client.findMany({
    where: { tenantId },
    select: { id: true, name: true, code: true, country: true },
    orderBy: { name: 'asc' },
  });
  const activeCountries = rules.filter((r) => r.active).map((r) => r.name);
  const filtered = !!(q || saldo || pais || custodio);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cada cliente tiene su código, su tarifa de envío, su tasa de servicio y su cuenta corriente."
        actions={
          <NewClientModal
            categories={categories.map((c) => ({ id: c.id, name: c.name, country: c.country, pricePerLb: c.pricePerLb, unit: c.unit, active: c.active }))}
            countries={activeCountries}
            referrers={everyone}
            defaultServiceFee={settings.personalShopperRatePercent}
          />
        }
      />

      <div className="filter-bar">
        <SearchFilter placeholder="Nombre, código (EC001), teléfono o correo…" />
        <SelectFilter
          label="Cuenta"
          paramName="saldo"
          allLabel="Todas"
          options={[
            { value: 'deuda', label: 'Con saldo pendiente' },
            { value: 'favor', label: 'Con saldo a favor' },
            { value: 'aldia', label: 'Al día' },
          ]}
        />
        <SelectFilter label="País" paramName="pais" allLabel="Todos" options={activeCountries.map((c) => ({ value: c, label: c }))} />
        <SelectFilter label="Custodio" paramName="custodio" allLabel="Todos" options={[{ value: '1', label: 'Con custodio activo' }]} />
      </div>

      <div className="muted small" style={{ margin: '0 0 12px 4px' }}>
        {clients.length} cliente(s){filtered ? ' con los filtros aplicados' : ''}.{' '}
        {filtered && <Link href="/clientes" className="link">Limpiar filtros</Link>}
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>CLIENTE</th>
              <th>PAÍS</th>
              <th>TARIFA ENVÍO</th>
              <th>SERVICIO</th>
              <th>BENEFICIOS</th>
              <th className="text-right">SALDO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const acc = accounts.get(c.id) ?? { pending: 0, credit: 0, net: 0 };
              const nBenefits = benefitsBy.get(c.id) ?? 0;
              return (
                <tr key={c.id}>
                  <td className="mono strong">{c.code}</td>
                  <td>
                    <Link href={`/clientes/${c.id}`} className="link">{c.name}</Link>
                    <div className="muted small">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                  </td>
                  <td>{c.country}{c.city ? <span className="muted small"> · {c.city}</span> : null}</td>
                  <td>{c.shippingCategory?.name ?? <span className="muted">Sin tarifa</span>}</td>
                  <td>{c.serviceFeePercent}%</td>
                  <td>
                    {nBenefits > 0 ? <ToneBadge tone="accent" small>🎁 {nBenefits}</ToneBadge> : <span className="muted">—</span>}
                    {c.custodyActive && <ToneBadge tone="info" small> 🏠 Custodio</ToneBadge>}
                  </td>
                  <td className="text-right nowrap">
                    {acc.pending > 0.004 ? (
                      <span className="money-due">{money(acc.pending)}</span>
                    ) : acc.credit > 0.004 ? (
                      <span className="money-ok">{money(acc.credit)} a favor</span>
                    ) : (
                      <span className="muted">Al día</span>
                    )}
                  </td>
                  <td className="nowrap">
                    <Link href={`/pedidos/nuevo?clientId=${c.id}`} className="btn btn-secondary btn-sm" title="Nuevo pedido">🛒</Link>{' '}
                    <Link href={`/clientes/${c.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {clients.length === 0 && <Empty icon="👥" title="No se encontraron clientes">Prueba con otros filtros o crea un cliente nuevo.</Empty>}
      </div>
    </>
  );
}
