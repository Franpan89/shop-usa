/**
 * Cada caso corresponde a un ejemplo numérico del documento "SHOP USA sistema".
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fromCents, toCents } from './money';
import {
  billableWeight,
  computePurchase,
  custodyFee,
  deliveryFee,
  effectiveServiceRate,
  formatClientCode,
  shippingCost,
} from './pricing';
import { invoiceStatusFor, planAllocations, runningBalances } from './ledger';
import {
  computeOrderStatus,
  isDeliveryAuthorized,
  isDispatchAuthorized,
  retentionDays,
  retentionLevel,
} from './flow';

const cents = toCents;

describe('Etapa 1 — peso facturable y tarifas', () => {
  it('tarifa general / familiar / Panamá: fracciones de 0.5 lb', () => {
    assert.equal(billableWeight(0.01, 'HALF_LB'), 0.5);
    assert.equal(billableWeight(0.5, 'HALF_LB'), 0.5);
    assert.equal(billableWeight(0.51, 'HALF_LB'), 1);
    assert.equal(billableWeight(1.0, 'HALF_LB'), 1);
    assert.equal(billableWeight(1.01, 'HALF_LB'), 1.5);
    assert.equal(billableWeight(1.51, 'HALF_LB'), 2);
    assert.equal(billableWeight(2.5, 'HALF_LB'), 2.5);
  });

  it('tarifa emprendedores: libra completa', () => {
    assert.equal(billableWeight(0.01, 'LB'), 1);
    assert.equal(billableWeight(1.0, 'LB'), 1);
    assert.equal(billableWeight(1.01, 'LB'), 2);
    assert.equal(billableWeight(2.01, 'LB'), 3);
    assert.equal(billableWeight(2.3, 'LB'), 3);
  });

  it('ejemplos de costo 1.3 y 1.4', () => {
    assert.equal(shippingCost(2.5, 7.5, 'HALF_LB'), 18.75); // general
    assert.equal(shippingCost(2.5, 6.5, 'HALF_LB'), 16.25); // familiar
    assert.equal(shippingCost(2.3, 5.41, 'LB'), 16.23); // emprendedor
    assert.equal(shippingCost(2.2, 5.5, 'HALF_LB'), 13.75); // Panamá
  });

  it('ejemplos de la Etapa 3.7 con 6.37 lb', () => {
    assert.equal(billableWeight(6.37, 'HALF_LB'), 6.5);
    assert.equal(shippingCost(6.37, 7.5, 'HALF_LB'), 48.75);
    assert.equal(shippingCost(6.37, 6.5, 'HALF_LB'), 42.25);
    assert.equal(billableWeight(6.37, 'LB'), 7);
    assert.equal(shippingCost(6.37, 5.41, 'LB'), 37.87);
    assert.equal(shippingCost(6.37, 5.5, 'HALF_LB'), 35.75);
  });

  it('ejemplo 3.13: emprendedor retiene y sigue pagando lo mismo', () => {
    assert.equal(shippingCost(8.2, 5.41, 'LB'), 48.69);
    assert.equal(shippingCost(8.9, 5.41, 'LB'), 48.69);
  });

  it('código de cliente', () => {
    assert.equal(formatClientCode('EC', 1), 'EC001');
    assert.equal(formatClientCode('pty', 4), 'PTY004');
    assert.equal(formatClientCode('EC', 1234), 'EC1234');
  });
});

describe('Etapa 2 — cálculo del Personal Shopper', () => {
  const lines = [
    { unitPrice: 5, quantity: 1 },
    { unitPrice: 5, quantity: 1 },
    { unitPrice: 5, quantity: 1 },
  ];

  it('cliente al 20 %: $15 + tax $0.98 = $15.98; servicio $3.20; total $19.18', () => {
    const t = computePurchase({ lines, taxRatePercent: 6.5, serviceRatePercent: 20 });
    assert.equal(t.subtotal, 15);
    assert.equal(t.tax, 0.98);
    assert.equal(t.invoiceTotal, 15.98);
    assert.equal(t.serviceFee, 3.2);
    assert.equal(t.total, 19.18);
  });

  it('cliente familiar al 10 %: servicio $1.60, total $17.58', () => {
    const t = computePurchase({ lines, taxRatePercent: 6.5, serviceRatePercent: 10 });
    assert.equal(t.serviceFee, 1.6);
    assert.equal(t.totalBeforeDiscount, 17.58);
  });

  it('descuento de $2.00 → total final $17.18', () => {
    const t = computePurchase({
      lines,
      taxRatePercent: 6.5,
      serviceRatePercent: 20,
      discount: { type: 'AMOUNT', value: 2 },
    });
    assert.equal(t.totalBeforeDiscount, 19.18);
    assert.equal(t.discountAmount, 2);
    assert.equal(t.total, 17.18);
  });

  it('descuento porcentual y tope en el total', () => {
    const t = computePurchase({
      lines,
      taxRatePercent: 6.5,
      serviceRatePercent: 20,
      discount: { type: 'PERCENT', value: 10 },
    });
    assert.equal(t.discountAmount, 1.92); // 10 % de 19.18 = 1.918
    const capped = computePurchase({
      lines,
      taxRatePercent: 6.5,
      serviceRatePercent: 20,
      discount: { type: 'AMOUNT', value: 999 },
    });
    assert.equal(capped.total, 0);
  });

  it('cantidad multiplica el precio unitario', () => {
    const t = computePurchase({
      lines: [{ unitPrice: 5, quantity: 3 }],
      taxRatePercent: 6.5,
      serviceRatePercent: 20,
    });
    assert.equal(t.subtotal, 15);
    assert.equal(t.total, 19.18);
  });
});

describe('Etapa 5 — Compramos tu carrito', () => {
  it('$100 + tax $6.50 = $106.50; servicio 10 % = $10.65; total $117.15', () => {
    const t = computePurchase({
      lines: [{ unitPrice: 100, quantity: 1 }],
      taxRatePercent: 6.5,
      serviceRatePercent: 10,
    });
    assert.equal(t.tax, 6.5);
    assert.equal(t.invoiceTotal, 106.5);
    assert.equal(t.serviceFee, 10.65);
    assert.equal(t.total, 117.15);
  });

  it('el shipping de la tienda se suma sin tax ni tasa de servicio', () => {
    const t = computePurchase({
      lines: [{ unitPrice: 100, quantity: 1 }],
      taxRatePercent: 6.5,
      serviceRatePercent: 10,
      extraCharges: 8,
    });
    assert.equal(t.serviceFee, 10.65);
    assert.equal(t.total, 125.15);
  });
});

describe('Referidos', () => {
  it('cada beneficio resta 5 puntos sobre la tasa habitual, sin acumular', () => {
    assert.deepEqual(effectiveServiceRate(20, 1, 5), { rate: 15, benefitApplied: true });
    assert.deepEqual(effectiveServiceRate(20, 3, 5), { rate: 15, benefitApplied: true });
    assert.deepEqual(effectiveServiceRate(15, 1, 5), { rate: 10, benefitApplied: true });
    assert.deepEqual(effectiveServiceRate(10, 1, 5), { rate: 5, benefitApplied: true });
    assert.deepEqual(effectiveServiceRate(20, 0, 5), { rate: 20, benefitApplied: false });
  });
});

describe('Etapa 7 — pagos, saldo a favor y estado de cuenta', () => {
  it('7.6: factura $45, pago $50 → factura pagada y $5 a favor', () => {
    const r = planAllocations(
      [{ id: 'F1', due: cents(45) }],
      [{ id: 'P1', available: cents(50) }],
    );
    assert.deepEqual(r.allocations, [{ paymentId: 'P1', invoiceId: 'F1', amount: cents(45) }]);
    assert.equal(r.creditRemaining, cents(5));
  });

  it('7.7: se aplica al saldo más antiguo primero ($20 PS, $45 envío, paga $50)', () => {
    const r = planAllocations(
      [
        { id: 'PS', due: cents(20) },
        { id: 'ENVIO', due: cents(45) },
      ],
      [{ id: 'P1', available: cents(50) }],
    );
    assert.deepEqual(r.allocations, [
      { paymentId: 'P1', invoiceId: 'PS', amount: cents(20) },
      { paymentId: 'P1', invoiceId: 'ENVIO', amount: cents(30) },
    ]);
    assert.equal(r.creditRemaining, 0);
  });

  it('7.8: el saldo a favor se usa solo en el siguiente cargo ($32 − $5 = $27)', () => {
    const r = planAllocations(
      [{ id: 'NUEVO', due: cents(32) }],
      [{ id: 'P1', available: cents(5) }],
    );
    assert.equal(r.allocations[0].amount, cents(5));
    assert.equal(cents(32) - r.allocations[0].amount, cents(27));
  });

  it('7.9: abono parcial ($86.25 con $40 → pendiente $46.25)', () => {
    const r = planAllocations(
      [{ id: 'F', due: cents(86.25) }],
      [{ id: 'P', available: cents(40) }],
    );
    const paid = r.allocations[0].amount;
    assert.equal(invoiceStatusFor(cents(86.25), paid), 'PARTIAL');
    assert.equal(fromCents(cents(86.25) - paid), 46.25);
    assert.equal(invoiceStatusFor(cents(86.25), cents(86.25)), 'PAID');
    assert.equal(invoiceStatusFor(cents(86.25), 0), 'PENDING');
  });

  it('un pago con factura destino la cubre primero aunque haya cargos más antiguos', () => {
    const r = planAllocations(
      [
        { id: 'VIEJA', due: cents(45) },
        { id: 'PEDIDO', due: cents(19.18) },
      ],
      [{ id: 'P', available: cents(19.18), targetInvoiceId: 'PEDIDO' }],
    );
    assert.deepEqual(r.allocations, [{ paymentId: 'P', invoiceId: 'PEDIDO', amount: cents(19.18) }]);
  });

  it('varios pagos se reparten sin aplicar dos veces el mismo dinero', () => {
    const r = planAllocations(
      [{ id: 'A', due: cents(30) }],
      [
        { id: 'P1', available: cents(20) },
        { id: 'P2', available: cents(20) },
      ],
    );
    assert.equal(r.allocations.reduce((s, a) => s + a.amount, 0), cents(30));
    assert.equal(r.creditRemaining, cents(10));
  });

  it('7.15: historial con saldo corrido ($20 + $45 − $50 = $15)', () => {
    const rows = runningBalances([
      { date: new Date('2026-10-05'), charge: cents(20), credit: 0 },
      { date: new Date('2026-10-07'), charge: cents(45), credit: 0 },
      { date: new Date('2026-10-08'), charge: 0, credit: cents(50) },
    ]);
    assert.deepEqual(rows.map((r) => r.balance), [cents(20), cents(65), cents(15)]);
  });
});

describe('Autorización de despacho y entrega por país', () => {
  const panama = { allowDispatchWithBalance: false, requireFullPaymentBeforeDelivery: true };
  const ecuador = { allowDispatchWithBalance: true, requireFullPaymentBeforeDelivery: true };

  it('Panamá: no despacha con saldo; sí al llegar a $0', () => {
    assert.equal(isDispatchAuthorized(15, panama), false);
    assert.equal(isDispatchAuthorized(0, panama), true);
  });

  it('Ecuador: despacha con saldo pero no entrega con saldo', () => {
    assert.equal(isDispatchAuthorized(25, ecuador), true);
    assert.equal(isDeliveryAuthorized(25, ecuador), false);
    assert.equal(isDeliveryAuthorized(0, ecuador), true);
  });

  it('un destino nuevo sin exigencia de pago entrega siempre', () => {
    assert.equal(isDeliveryAuthorized(40, { allowDispatchWithBalance: true, requireFullPaymentBeforeDelivery: false }), true);
  });
});

describe('Estado del pedido', () => {
  const base = { cancelled: false, invoicePaid: false, courtesyAuthorized: false, hasPendingProof: false };

  it('sin pago → pendiente; con comprobante → por verificar; pagado → listo para comprar', () => {
    assert.equal(computeOrderStatus({ ...base, productStatuses: ['PENDING_PAYMENT'] }), 'PENDING_PAYMENT');
    assert.equal(computeOrderStatus({ ...base, hasPendingProof: true, productStatuses: ['PENDING_PAYMENT'] }), 'PAYMENT_REVIEW');
    assert.equal(computeOrderStatus({ ...base, invoicePaid: true, productStatuses: ['READY_TO_BUY'] }), 'READY_TO_BUY');
  });

  it('la cortesía autorizada habilita la compra sin pago completo', () => {
    assert.equal(computeOrderStatus({ ...base, courtesyAuthorized: true, productStatuses: ['READY_TO_BUY'] }), 'READY_TO_BUY');
  });

  it('compra por producto: parcial → comprado → recibido', () => {
    const paid = { ...base, invoicePaid: true };
    assert.equal(computeOrderStatus({ ...paid, productStatuses: ['PURCHASED', 'PURCHASED', 'READY_TO_BUY'] }), 'PARTIALLY_PURCHASED');
    assert.equal(computeOrderStatus({ ...paid, productStatuses: ['PURCHASED', 'RECEIVED'] }), 'PURCHASED');
    assert.equal(computeOrderStatus({ ...paid, productStatuses: ['RECEIVED', 'IN_TRANSIT'] }), 'RECEIVED');
  });

  it('un pedido cancelado se mantiene cancelado', () => {
    assert.equal(computeOrderStatus({ ...base, cancelled: true, productStatuses: ['CANCELLED'] }), 'CANCELLED');
  });
});

describe('Retención (3.14 – 3.16)', () => {
  it('días retenidos y niveles de advertencia a los 21 y 30 días', () => {
    const start = new Date('2026-10-01T00:00:00Z');
    assert.equal(retentionDays(start, new Date('2026-10-08T00:00:00Z')), 7);
    assert.equal(retentionDays(start, new Date('2026-10-23T00:00:00Z')), 22);
    assert.equal(retentionDays(start, new Date('2026-11-01T00:00:00Z')), 31);
    assert.equal(retentionLevel(7, true, 21, 30), 'ok');
    assert.equal(retentionLevel(22, true, 21, 30), 'warning');
    assert.equal(retentionLevel(31, true, 21, 30), 'overdue');
    assert.equal(retentionLevel(40, false, 21, 30), 'none');
  });
});

describe('Custodio (Etapa 9)', () => {
  const fees = { small: 3, medium: 4, large: 5 };
  const delivery = { baseFee: 15, baseMiles: 5, extraPerMile: 1.5 };

  it('tarifa por tamaño', () => {
    assert.equal(custodyFee('SMALL', fees), 3);
    assert.equal(custodyFee('MEDIUM', fees), 4);
    assert.equal(custodyFee('LARGE', fees), 5);
  });

  it('delivery: 0–5 millas $15; más de 5 millas $15 + $1.50 por milla adicional', () => {
    assert.equal(deliveryFee(0, delivery), 15);
    assert.equal(deliveryFee(5, delivery), 15);
    assert.equal(deliveryFee(6, delivery), 16.5);
    assert.equal(deliveryFee(12, delivery), 25.5);
  });
});
