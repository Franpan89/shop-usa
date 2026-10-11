/**
 * Aplicación automática de pagos (Etapa 7). Todo en centavos enteros.
 *
 * Reglas:
 *  - Un pago se registra una sola vez y el sistema lo reparte entre los cargos del cliente.
 *  - Se aplica empezando por el saldo pendiente más antiguo.
 *  - Si el pago indica una factura destino, esa se cubre primero.
 *  - Lo que sobra queda como saldo a favor.
 */

export interface DueInvoice {
  id: string;
  /** centavos pendientes de pagar */
  due: number;
}

export interface AvailablePayment {
  id: string;
  /** centavos aún sin aplicar */
  available: number;
  targetInvoiceId?: string | null;
}

export interface PlannedAllocation {
  paymentId: string;
  invoiceId: string;
  /** centavos */
  amount: number;
}

/**
 * `invoices` debe venir ordenado de la más antigua a la más reciente y
 * `payments` del más antiguo al más reciente.
 */
export function planAllocations(
  invoices: DueInvoice[],
  payments: AvailablePayment[],
): { allocations: PlannedAllocation[]; creditRemaining: number } {
  const due = new Map(invoices.map((i) => [i.id, Math.max(0, i.due)]));
  const allocations: PlannedAllocation[] = [];
  let creditRemaining = 0;

  for (const payment of payments) {
    let left = Math.max(0, payment.available);

    const take = (invoiceId: string) => {
      const owed = due.get(invoiceId) ?? 0;
      const amount = Math.min(left, owed);
      if (amount <= 0) return;
      allocations.push({ paymentId: payment.id, invoiceId, amount });
      due.set(invoiceId, owed - amount);
      left -= amount;
    };

    if (payment.targetInvoiceId) take(payment.targetInvoiceId);
    for (const inv of invoices) {
      if (left <= 0) break;
      take(inv.id);
    }
    creditRemaining += left;
  }

  return { allocations, creditRemaining };
}

export type InvoiceStatusValue = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export function invoiceStatusFor(totalCents: number, paidCents: number): Exclude<InvoiceStatusValue, 'CANCELLED'> {
  if (paidCents >= totalCents) return 'PAID';
  if (paidCents > 0) return 'PARTIAL';
  return 'PENDING';
}

export interface StatementEntry {
  date: Date;
  /** centavos; positivo = cargo */
  charge: number;
  /** centavos; positivo = pago / crédito */
  credit: number;
}

/** Saldo corrido: positivo = el cliente debe, negativo = saldo a favor. */
export function runningBalances<T extends StatementEntry>(entries: T[]): (T & { balance: number })[] {
  let balance = 0;
  return [...entries]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => {
      balance += e.charge - e.credit;
      return { ...e, balance };
    });
}
