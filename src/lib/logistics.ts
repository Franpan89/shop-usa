import 'server-only';
import { getCountryRules, getSettings, getTenantId, type Db } from '@/lib/tenant';
import { DEFAULT_COUNTRY_RULE, type CountryRuleLite } from '@/lib/domain/flow';
import { toCents, fromCents } from '@/lib/domain/money';

/** Saldo pendiente de la factura de despacho (0 si no hay factura o está anulada). */
export function invoiceBalanceOf(
  invoice: { total: number; paidAmount: number; status: string } | null | undefined,
): number {
  if (!invoice || invoice.status === 'CANCELLED') return 0;
  return Math.max(0, fromCents(toCents(invoice.total) - toCents(invoice.paidAmount)));
}

export async function getCountryRuleMap(db?: Db) {
  const rules = await getCountryRules(db);
  const map = new Map<string, CountryRuleLite & { name: string; usesDeconsolidation: boolean }>();
  for (const r of rules) map.set(r.name.toLowerCase(), r);
  return {
    rules,
    ruleFor(country: string): CountryRuleLite & { usesDeconsolidation: boolean } {
      return map.get(country.toLowerCase()) ?? { ...DEFAULT_COUNTRY_RULE, usesDeconsolidation: false };
    },
  };
}

/** Próximo número de PKG sugerido: nunca menor al inicial configurado ni a un PKG existente. */
export async function suggestNextPkgNumber(db: Db): Promise<number> {
  const tenantId = await getTenantId();
  const settings = await getSettings(db);
  const last = await db.pkg.findFirst({ where: { tenantId }, orderBy: { number: 'desc' }, select: { number: true } });
  return Math.max(settings.pkgStartNumber, (last?.number ?? 0) + 1);
}

export const pkgCode = (n: number) => `PKG${n}`;
export const dispatchCode = (n: number) => `DSP${String(n).padStart(3, '0')}`;
export const orderCode = (n: number) => `#${String(n).padStart(3, '0')}`;
export const invoiceCode = (n: number) => `FAC-${String(n).padStart(4, '0')}`;
