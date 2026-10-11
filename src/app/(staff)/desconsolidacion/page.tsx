import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getTenantId } from '@/lib/tenant';
import { isDeliveryAuthorized } from '@/lib/domain/flow';
import { getCountryRuleMap, invoiceBalanceOf, pkgCode } from '@/lib/logistics';
import { Alert, Empty, PageHeader, Panel } from '@/components/ui/kit';
import { DeconList, PkgSelector, type DeconGroup } from './DeconControls';

export const dynamic = 'force-dynamic';

/**
 * Desconsolidación (8.18 – 8.21): el equipo en destino marca los PKG que llegaron y el sistema
 * reorganiza todo agrupado por cliente, conservando de qué PKG viene cada producto.
 */
export default async function DesconsolidacionPage({ searchParams }: { searchParams: Promise<{ pkgs?: string }> }) {
  await requireStaff();
  const { pkgs: pkgsParam } = await searchParams;
  const tenantId = await getTenantId();
  const { ruleFor } = await getCountryRuleMap();
  const ids = (pkgsParam ?? '').split(',').filter(Boolean);

  if (ids.length === 0) {
    const inTransit = await prisma.pkg.findMany({
      where: { tenantId, status: { in: ['IN_TRANSIT', 'AT_DESTINATION'] } },
      include: { products: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } }, dispatch: { select: { number: true } } },
      orderBy: { number: 'asc' },
    });
    const usable = inTransit.filter((p) => ruleFor(p.country).usesDeconsolidation);
    return (
      <>
        <PageHeader title="Desconsolidación" subtitle="Selecciona los PKG que llegaron físicamente. El sistema trae su contenido y lo agrupa por cliente: nada de Excel." />
        <Panel title="PKG en tránsito" subtitle="Solo los destinos que usan cajas compartidas (configurable por país).">
          {usable.length === 0 ? <Empty icon="🗂️" title="No hay PKG por desconsolidar">Aparecen cuando un despacho se confirma.</Empty> : <PkgSelector pkgs={usable.map((p) => ({ id: p.id, code: pkgCode(p.number), units: p.products.reduce((s, x) => s + x.quantity, 0), status: p.status, country: p.country }))} />}
        </Panel>
      </>
    );
  }

  const products = await prisma.product.findMany({
    where: { pkgId: { in: ids }, status: { in: ['IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED'] } },
    include: {
      client: { select: { id: true, name: true, code: true, country: true } },
      pkg: { select: { number: true } },
      consolidation: { select: { invoice: { select: { total: true, paidAmount: true, status: true } } } },
    },
    orderBy: [{ client: { name: 'asc' } }, { createdAt: 'asc' }],
  });

  const groups = new Map<string, DeconGroup>();
  for (const p of products) {
    if (!groups.has(p.client.id)) {
      const balance = invoiceBalanceOf(p.consolidation?.invoice);
      groups.set(p.client.id, { clientId: p.client.id, clientName: p.client.name, clientCode: p.client.code, balance, authorized: isDeliveryAuthorized(balance, ruleFor(p.client.country)), items: [] });
    }
    groups.get(p.client.id)!.items.push({
      id: p.id, name: p.name, quantity: p.quantity, imageUrl: p.imageUrl, pkgCode: p.pkg ? pkgCode(p.pkg.number) : '—',
      done: p.status !== 'IN_TRANSIT', issueNote: p.issueNote,
    });
  }
  const list = Array.from(groups.values());
  const pending = list.reduce((s, g) => s + g.items.filter((i) => !i.done).length, 0);

  return (
    <>
      <PageHeader back={{ href: '/desconsolidacion', label: 'Elegir otros PKG' }} title="Desconsolidación" subtitle={`${list.length} cliente(s) · ${products.length} producto(s) · ${pending} por confirmar. Prepara una sola funda por cliente.`} />
      {pending === 0 && <Alert tone="success">Todo confirmado. Los productos ya están <strong>listos para retirar</strong>. <Link href="/entregas" className="link">Ir a Entregas →</Link></Alert>}
      {list.length === 0 ? <div className="glass-panel static"><Empty icon="🗂️" title="Estos PKG no tienen productos pendientes" /></div> : <DeconList groups={list} />}
    </>
  );
}
