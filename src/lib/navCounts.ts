import 'server-only';
import prisma from '@/lib/prisma';

export type NavCounts = Partial<Record<'accesos' | 'pagos' | 'compras' | 'recepcion' | 'consolidados' | 'cajas' | 'desconsolidacion' | 'entregas' | 'custodio', number>>;

/** Contadores que muestra el menú lateral: lo que está esperando acción en cada módulo. */
export async function getNavCounts(): Promise<NavCounts> {
  try {
    const [accesos, pagos, compras, recepcion, consolidados, cajas, desconsolidacion, entregas, custodio] = await Promise.all([
      prisma.accessRequest.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'PENDING_VERIFICATION' } }),
      prisma.product.count({ where: { status: 'READY_TO_BUY' } }),
      prisma.product.count({ where: { status: 'PURCHASED' } }),
      prisma.consolidation.count({ where: { status: 'OPEN', products: { some: { status: 'RECEIVED' } } } }),
      prisma.product.count({ where: { status: 'RECEIVED', pkgId: null, consolidation: { status: 'CLOSED' } } }),
      prisma.pkg.count({ where: { status: { in: ['IN_TRANSIT', 'AT_DESTINATION'] } } }),
      prisma.product.count({ where: { status: 'READY_FOR_PICKUP' } }),
      prisma.custodyPackage.count({ where: { status: 'IN_CUSTODY' } }),
    ]);
    return { accesos, pagos, compras, recepcion, consolidados, cajas, desconsolidacion, entregas, custodio };
  } catch {
    // Un contador que falla nunca debe tumbar toda la aplicación.
    return {};
  }
}
