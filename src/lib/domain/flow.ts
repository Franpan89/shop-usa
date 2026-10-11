import type {
  ConsolidationStatus,
  DispatchDecision,
  InvoiceStatus,
  InvoiceType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PkgStatus,
  ProductOrigin,
  ProductStatus,
} from '@prisma/client';

/** Clases de badge definidas en globals.css */
export type BadgeTone = 'success' | 'warning' | 'info' | 'secondary' | 'danger' | 'accent';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

// ── Productos ───────────────────────────────────────────────────────────────

export const PRODUCT_STATUS: Record<ProductStatus, StatusMeta & { clientLabel: string }> = {
  PENDING_PAYMENT: { label: 'Pendiente de pago', clientLabel: 'Pendiente de pago', tone: 'warning' },
  READY_TO_BUY: { label: 'Listo para comprar', clientLabel: 'En proceso de compra', tone: 'info' },
  PURCHASED: { label: 'Comprado', clientLabel: 'Comprado — en camino a bodega USA', tone: 'accent' },
  RECEIVED: { label: 'Recibido en bodega', clientLabel: 'En bodega USA', tone: 'secondary' },
  IN_TRANSIT: { label: 'En tránsito', clientLabel: 'En tránsito', tone: 'warning' },
  READY_FOR_PICKUP: { label: 'Listo para retirar', clientLabel: 'Listo para retirar', tone: 'success' },
  DELIVERED: { label: 'Entregado', clientLabel: 'Entregado', tone: 'success' },
  CANCELLED: { label: 'Cancelado', clientLabel: 'Cancelado', tone: 'danger' },
};

/** Orden del recorrido; sirve para comparar "ya pasó por X". */
export const PRODUCT_STATUS_RANK: Record<ProductStatus, number> = {
  PENDING_PAYMENT: 0,
  READY_TO_BUY: 1,
  PURCHASED: 2,
  RECEIVED: 3,
  IN_TRANSIT: 4,
  READY_FOR_PICKUP: 5,
  DELIVERED: 6,
  CANCELLED: -1,
};

export const ORIGIN: Record<ProductOrigin, { label: string; icon: string; tone: BadgeTone }> = {
  PERSONAL_SHOPPER: { label: 'Personal Shopper', icon: '🛍️', tone: 'accent' },
  CASILLERO: { label: 'Casillero', icon: '📬', tone: 'info' },
  CART: { label: 'Compramos tu carrito', icon: '🛒', tone: 'warning' },
};

// ── Pedidos ─────────────────────────────────────────────────────────────────

export const ORDER_TYPE: Record<OrderType, { label: string; short: string; icon: string }> = {
  PERSONAL_SHOPPER: { label: 'Personal Shopper', short: 'PS', icon: '🛍️' },
  CART: { label: 'Compramos tu carrito', short: 'Carrito', icon: '🛒' },
};

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: 'Pendiente de pago', tone: 'warning' },
  PAYMENT_REVIEW: { label: 'Pago por verificar', tone: 'info' },
  READY_TO_BUY: { label: 'Listo para comprar', tone: 'accent' },
  PARTIALLY_PURCHASED: { label: 'Compra parcial', tone: 'accent' },
  PURCHASED: { label: 'Comprado', tone: 'success' },
  RECEIVED: { label: 'Recibido', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
};

/** Pasos visibles en la barra de progreso del pedido. */
export const ORDER_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'PENDING_PAYMENT', label: 'Pendiente de pago' },
  { key: 'PAYMENT_REVIEW', label: 'Pago por verificar' },
  { key: 'READY_TO_BUY', label: 'Listo para comprar' },
  { key: 'PURCHASED', label: 'Comprado' },
  { key: 'RECEIVED', label: 'Recibido' },
];

export function orderStepIndex(status: OrderStatus): number {
  if (status === 'PARTIALLY_PURCHASED') return ORDER_STEPS.findIndex((s) => s.key === 'READY_TO_BUY');
  return ORDER_STEPS.findIndex((s) => s.key === status);
}

/**
 * Estado del pedido a partir de los hechos: factura, comprobantes y productos.
 * Es la única fuente de verdad: se recalcula cada vez que cambia algo relevante.
 */
export function computeOrderStatus(input: {
  cancelled: boolean;
  invoicePaid: boolean;
  courtesyAuthorized: boolean;
  hasPendingProof: boolean;
  productStatuses: ProductStatus[];
}): OrderStatus {
  if (input.cancelled) return 'CANCELLED';
  const live = input.productStatuses.filter((s) => s !== 'CANCELLED');
  const rank = (s: ProductStatus) => PRODUCT_STATUS_RANK[s];

  if (live.length > 0 && live.every((s) => rank(s) >= rank('RECEIVED'))) return 'RECEIVED';
  if (live.length > 0 && live.every((s) => rank(s) >= rank('PURCHASED'))) return 'PURCHASED';
  if (live.some((s) => rank(s) >= rank('PURCHASED'))) return 'PARTIALLY_PURCHASED';
  if (input.invoicePaid || input.courtesyAuthorized) return 'READY_TO_BUY';
  if (input.hasPendingProof) return 'PAYMENT_REVIEW';
  return 'PENDING_PAYMENT';
}

// ── Facturas y pagos ────────────────────────────────────────────────────────

export const INVOICE_TYPE: Record<InvoiceType, string> = {
  PERSONAL_SHOPPER: 'Personal Shopper',
  CART: 'Compramos tu carrito',
  SHIPPING: 'Envío internacional',
  CUSTODY: 'Custodio de paquetería',
  DELIVERY: 'Delivery',
  OTHER: 'Otro cargo',
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  PARTIAL: { label: 'Parcialmente pagada', tone: 'info' },
  PAID: { label: 'Pagada', tone: 'success' },
  CANCELLED: { label: 'Anulada', tone: 'secondary' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  PENDING_VERIFICATION: { label: 'Por verificar', tone: 'info' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
  VOIDED: { label: 'Anulado', tone: 'secondary' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CASH: 'Efectivo',
  ONLINE: 'Pago en plataforma',
  CREDIT: 'Crédito / ajuste',
  OTHER: 'Otro',
};

// ── Consolidado, PKG, despacho ──────────────────────────────────────────────

export function consolidationLabel(status: ConsolidationStatus, decision: DispatchDecision): StatusMeta {
  if (status === 'CLOSED') return { label: 'Listo para despacho', tone: 'success' };
  if (decision === 'HOLD') return { label: 'Mercancía retenida', tone: 'warning' };
  return { label: 'Abierto · se despacha', tone: 'info' };
}

export const PKG_STATUS: Record<PkgStatus, StatusMeta> = {
  IN_PREPARATION: { label: 'En preparación', tone: 'warning' },
  CLOSED: { label: 'Cerrado', tone: 'info' },
  IN_TRANSIT: { label: 'En tránsito', tone: 'accent' },
  AT_DESTINATION: { label: 'En destino / aduana', tone: 'accent' },
  READY_FOR_PICKUP: { label: 'Listo para retirar', tone: 'success' },
  DELIVERED: { label: 'Entregado', tone: 'success' },
};

/** Estado de producto que se refleja cuando el PKG cambia de estado. */
export const PKG_TO_PRODUCT_STATUS: Partial<Record<PkgStatus, ProductStatus>> = {
  CLOSED: 'RECEIVED',
  IN_TRANSIT: 'IN_TRANSIT',
  AT_DESTINATION: 'IN_TRANSIT',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  DELIVERED: 'DELIVERED',
};

// ── Retención ───────────────────────────────────────────────────────────────

export function retentionDays(start: Date | null | undefined, now: Date = new Date()): number {
  if (!start) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}

export type RetentionLevel = 'none' | 'ok' | 'warning' | 'overdue';

export function retentionLevel(
  days: number,
  held: boolean,
  warningDays: number,
  maxDays: number,
): RetentionLevel {
  if (!held) return 'none';
  if (days >= maxDays) return 'overdue';
  if (days >= warningDays) return 'warning';
  return 'ok';
}

// ── Autorización por país ───────────────────────────────────────────────────

export interface CountryRuleLite {
  allowDispatchWithBalance: boolean;
  requireFullPaymentBeforeDelivery: boolean;
}

export const DEFAULT_COUNTRY_RULE: CountryRuleLite = {
  allowDispatchWithBalance: false,
  requireFullPaymentBeforeDelivery: true,
};

/** ¿Puede salir de USA? (Panamá: solo con la factura de despacho pagada.) */
export function isDispatchAuthorized(invoiceBalance: number, rule: CountryRuleLite): boolean {
  return rule.allowDispatchWithBalance || invoiceBalance <= 0.004;
}

/** ¿Puede entregarse en destino? (Ecuador: no mientras la factura tenga saldo.) */
export function isDeliveryAuthorized(invoiceBalance: number, rule: CountryRuleLite): boolean {
  return !rule.requireFullPaymentBeforeDelivery || invoiceBalance <= 0.004;
}
