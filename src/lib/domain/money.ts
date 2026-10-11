/**
 * Aritmética de dinero en centavos enteros para evitar errores de coma flotante
 * (p. ej. 15 × 6.5 % = 0.975 → 0.98, nunca 0.97).
 */

export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function round2(amount: number): number {
  return fromCents(toCents(amount));
}

/** `pct` % de `cents`, redondeado al centavo (mitad hacia arriba). */
export function pctOfCents(cents: number, pct: number): number {
  return Math.round((cents * Math.round(pct * 100)) / 10000);
}

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
