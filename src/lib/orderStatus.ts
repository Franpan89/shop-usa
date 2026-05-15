export type OrderStatus = 'READY_TO_SHIP' | 'SHIPPED' | 'ARRIVED' | 'DELIVERED';

export const ORDER_STATUSES: OrderStatus[] = ['READY_TO_SHIP', 'SHIPPED', 'ARRIVED', 'DELIVERED'];

export const STATUS_LABEL_ES: Record<OrderStatus, string> = {
  READY_TO_SHIP: 'Listo para Enviar',
  SHIPPED: 'Enviado',
  ARRIVED: 'Llegó al país',
  DELIVERED: 'Entregado',
};

export const STATUS_SHORT_LABEL_ES: Record<OrderStatus, string> = {
  READY_TO_SHIP: 'Listo',
  SHIPPED: 'Enviado',
  ARRIVED: 'Llegó',
  DELIVERED: 'Entregado',
};

export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  READY_TO_SHIP: 'badge-secondary',
  SHIPPED: 'badge-warning',
  ARRIVED: 'badge-info',
  DELIVERED: 'badge-success',
};

export const STATUS_ICON: Record<OrderStatus, string> = {
  READY_TO_SHIP: '📋',
  SHIPPED: '🚢',
  ARRIVED: '🛬',
  DELIVERED: '✅',
};

const ALIASES: Record<string, OrderStatus> = {
  PENDING: 'READY_TO_SHIP',
  IN_TRANSIT: 'SHIPPED',
};

export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus {
  if (!raw) return 'READY_TO_SHIP';
  if (ORDER_STATUSES.includes(raw as OrderStatus)) return raw as OrderStatus;
  if (raw in ALIASES) return ALIASES[raw];
  return 'READY_TO_SHIP';
}

export function statusLabel(raw: string | null | undefined): string {
  return STATUS_LABEL_ES[normalizeOrderStatus(raw)];
}

export function statusBadgeClass(raw: string | null | undefined): string {
  return STATUS_BADGE_CLASS[normalizeOrderStatus(raw)];
}
