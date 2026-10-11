import { fromCents, pctOfCents, toCents } from './money';

export type BillingUnit = 'HALF_LB' | 'LB';

/**
 * Peso facturable según la forma de facturación de la tarifa:
 *  - HALF_LB: fracciones de 0.5 lb (0.01–0.5 → 0.5, 0.51–1.0 → 1, …)
 *  - LB: libra completa (0.01–1.0 → 1, 1.01–2.0 → 2, …)
 */
export function billableWeight(realWeight: number, unit: BillingUnit): number {
  const cents = toCents(realWeight);
  if (!(cents > 0)) return 0;
  const stepCents = unit === 'LB' ? 100 : 50;
  return (Math.ceil(cents / stepCents) * stepCents) / 100;
}

/** Valor del envío = peso facturable × precio por libra de la tarifa del cliente. */
export function shippingCost(realWeight: number, pricePerLb: number, unit: BillingUnit): number {
  const billable = billableWeight(realWeight, unit);
  return fromCents(Math.round(billable * toCents(pricePerLb)));
}

export interface PurchaseLine {
  unitPrice: number;
  quantity: number;
}

export type DiscountInput = { type: 'AMOUNT' | 'PERCENT'; value: number } | null | undefined;

export interface PurchaseInput {
  lines: PurchaseLine[];
  taxRatePercent: number;
  serviceRatePercent: number;
  /** Otros costos de la compra (p. ej. shipping cobrado por la tienda). Sin tax ni tasa de servicio. */
  extraCharges?: number;
  discount?: DiscountInput;
}

export interface PurchaseTotals {
  subtotal: number;
  tax: number;
  /** productos + tax */
  invoiceTotal: number;
  /** calculada sobre productos + tax, nunca solo sobre los productos */
  serviceFee: number;
  extraCharges: number;
  totalBeforeDiscount: number;
  discountAmount: number;
  total: number;
}

export function computePurchase(input: PurchaseInput): PurchaseTotals {
  const subtotalCents = input.lines.reduce(
    (sum, l) => sum + Math.round(toCents(l.unitPrice) * (l.quantity > 0 ? l.quantity : 0)),
    0,
  );
  const taxCents = pctOfCents(subtotalCents, input.taxRatePercent);
  const invoiceTotalCents = subtotalCents + taxCents;
  const serviceCents = pctOfCents(invoiceTotalCents, input.serviceRatePercent);
  const extraCents = Math.max(0, toCents(input.extraCharges ?? 0));
  const beforeDiscountCents = invoiceTotalCents + serviceCents + extraCents;

  let discountCents = 0;
  const d = input.discount;
  if (d && d.value > 0) {
    discountCents = d.type === 'PERCENT' ? pctOfCents(beforeDiscountCents, d.value) : toCents(d.value);
    discountCents = Math.min(discountCents, beforeDiscountCents);
  }

  return {
    subtotal: fromCents(subtotalCents),
    tax: fromCents(taxCents),
    invoiceTotal: fromCents(invoiceTotalCents),
    serviceFee: fromCents(serviceCents),
    extraCharges: fromCents(extraCents),
    totalBeforeDiscount: fromCents(beforeDiscountCents),
    discountAmount: fromCents(discountCents),
    total: fromCents(beforeDiscountCents - discountCents),
  };
}

/**
 * Programa de referidos: cada beneficio reduce N puntos porcentuales sobre la tasa
 * habitual del cliente durante UNA factura. Nunca se acumulan dentro de la misma factura.
 */
export function effectiveServiceRate(
  baseRatePercent: number,
  benefitsAvailable: number,
  discountPoints: number,
): { rate: number; benefitApplied: boolean } {
  if (benefitsAvailable > 0 && discountPoints > 0) {
    return { rate: Math.max(0, baseRatePercent - discountPoints), benefitApplied: true };
  }
  return { rate: baseRatePercent, benefitApplied: false };
}

export interface CustodyFees {
  small: number;
  medium: number;
  large: number;
}

export function custodyFee(size: 'SMALL' | 'MEDIUM' | 'LARGE', fees: CustodyFees): number {
  return size === 'SMALL' ? fees.small : size === 'MEDIUM' ? fees.medium : fees.large;
}

/** Delivery: tarifa base hasta N millas; cada milla adicional se suma. */
export function deliveryFee(
  miles: number,
  cfg: { baseFee: number; baseMiles: number; extraPerMile: number },
): number {
  const extraMiles = Math.max(0, miles - cfg.baseMiles);
  return fromCents(toCents(cfg.baseFee) + Math.round(extraMiles * toCents(cfg.extraPerMile)));
}

/** Código de cliente: prefijo del país + consecutivo (EC001, PTY004…). */
export function formatClientCode(prefix: string, n: number): string {
  return `${prefix.toUpperCase()}${String(n).padStart(3, '0')}`;
}
