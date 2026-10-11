import 'server-only';
import { cache } from 'react';
import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { DEFAULT_COUNTRY_RULE, type CountryRuleLite } from '@/lib/domain/flow';

/** Cliente de Prisma o cliente transaccional: las funciones de este módulo aceptan ambos. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Shop USA opera con un solo tenant; se resuelve una vez por request. */
export const getTenant = cache(async () => {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No hay tenant configurado');
  return tenant;
});

export async function getTenantId(): Promise<string> {
  return (await getTenant()).id;
}

/** Configuración del negocio; la crea con los valores del documento si todavía no existe. */
export async function getSettings(db: Db = prisma) {
  const tenantId = await getTenantId();
  const existing = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.tenantSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
}

const DEFAULT_COUNTRIES = [
  { name: 'Ecuador', codePrefix: 'EC', allowDispatchWithBalance: true, requireFullPaymentBeforeDelivery: true, usesDeconsolidation: true },
  { name: 'Panamá', codePrefix: 'PTY', allowDispatchWithBalance: false, requireFullPaymentBeforeDelivery: true, usesDeconsolidation: false },
];

/** Países de destino y sus reglas (7.12). Siembra Ecuador y Panamá la primera vez. */
export async function getCountryRules(db: Db = prisma) {
  const tenantId = await getTenantId();
  let rules = await db.countryRule.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  if (rules.length === 0) {
    await db.countryRule.createMany({ data: DEFAULT_COUNTRIES.map((c) => ({ ...c, tenantId })), skipDuplicates: true });
    rules = await db.countryRule.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }
  return rules;
}

export async function getCountryRule(country: string, db: Db = prisma): Promise<CountryRuleLite> {
  const rules = await getCountryRules(db);
  const rule = rules.find((r) => r.name.toLowerCase() === country.toLowerCase());
  return rule ?? DEFAULT_COUNTRY_RULE;
}

/**
 * Transacción interactiva con más holgura que el valor por defecto de Prisma (5 s):
 * la base está remota y varias operaciones encadenan decenas de consultas.
 */
export function inTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });
}

/** Siguiente número consecutivo (atómico). */
export async function nextNumber(db: Db, tenantId: string, key: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export async function audit(
  db: Db,
  entry: { userName?: string | null; action: string; entity: string; entityId?: string | null; data?: Prisma.InputJsonValue },
) {
  const tenantId = await getTenantId();
  await db.auditLog.create({
    data: {
      tenantId,
      userName: entry.userName ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      data: entry.data ?? undefined,
    },
  });
}
