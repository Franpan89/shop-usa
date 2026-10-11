import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Siembra idempotente: deja la configuración inicial del documento "SHOP USA sistema".
 * Se puede correr varias veces sin duplicar nada. No crea clientes ni pedidos de prueba.
 *   npm run seed
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Nombres anteriores → nombres del documento (se renombran para no perder los clientes asignados).
const RENAMES: Record<string, string> = {
  'Ecuador Normal': 'Ecuador General',
  'Ecuador Migrante': 'Ecuador Familiar / Migrante',
  'Ecuador Emprendedor': 'Ecuador Emprendedores',
};

const CATEGORIES = [
  { name: 'Ecuador General', country: 'Ecuador', pricePerLb: 7.5, unit: 'HALF_LB' as const },
  { name: 'Ecuador Familiar / Migrante', country: 'Ecuador', pricePerLb: 6.5, unit: 'HALF_LB' as const },
  { name: 'Ecuador Emprendedores', country: 'Ecuador', pricePerLb: 5.41, unit: 'LB' as const },
  { name: 'Panamá', country: 'Panamá', pricePerLb: 5.5, unit: 'HALF_LB' as const },
];

const COUNTRIES = [
  { name: 'Ecuador', codePrefix: 'EC', allowDispatchWithBalance: true, requireFullPaymentBeforeDelivery: true, usesDeconsolidation: true },
  { name: 'Panamá', codePrefix: 'PTY', allowDispatchWithBalance: false, requireFullPaymentBeforeDelivery: true, usesDeconsolidation: false },
];

async function main() {
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) tenant = await prisma.tenant.create({ data: { name: 'ShopUSA' } });
  const tenantId = tenant.id;

  await prisma.tenantSettings.upsert({ where: { tenantId }, update: {}, create: { tenantId } });

  for (const c of COUNTRIES) {
    await prisma.countryRule.upsert({
      where: { tenantId_name: { tenantId, name: c.name } },
      update: {},
      create: { ...c, tenantId },
    });
  }

  for (const [from, to] of Object.entries(RENAMES)) {
    const old = await prisma.shippingCategory.findUnique({ where: { tenantId_name: { tenantId, name: from } } });
    const target = await prisma.shippingCategory.findUnique({ where: { tenantId_name: { tenantId, name: to } } });
    if (old && !target) await prisma.shippingCategory.update({ where: { id: old.id }, data: { name: to } });
  }
  for (const c of CATEGORIES) {
    const existing = await prisma.shippingCategory.findUnique({ where: { tenantId_name: { tenantId, name: c.name } } });
    if (!existing) {
      await prisma.shippingCategory.create({ data: { ...c, tenantId } });
    } else if (existing.pricePerLb === 0) {
      // Filas migradas del esquema anterior: toman el precio por libra del documento.
      await prisma.shippingCategory.update({ where: { id: existing.id }, data: { pricePerLb: c.pricePerLb, unit: c.unit } });
    }
  }

  console.log('Configuración inicial lista: tasas, países y tarifas de envío.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
