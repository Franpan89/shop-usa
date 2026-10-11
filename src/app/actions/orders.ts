'use server';

import { safe } from '@/lib/action';
import type { OrderType, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdmin, requireStaff } from '@/lib/auth';
import {
  audit,
  getSettings,
  getTenantId,
  inTransaction,
  nextNumber,
  type Db,
} from '@/lib/tenant';
import {
  cancelInvoice,
  consumeBenefit,
  countAvailableBenefits,
  createInvoice,
  reconcileClient,
  refreshOrder,
  type InvoiceLineInput,
} from '@/lib/accounting';
import { computePurchase, effectiveServiceRate } from '@/lib/domain/pricing';
import { PRODUCT_STATUS_RANK } from '@/lib/domain/flow';
import { recordCatalogUsage } from '@/lib/catalog';

export interface OrderItemInput {
  name: string;
  quantity: number;
  unitPrice: number;
  storeName?: string;
  url?: string;
  variant?: string;
  notes?: string;
  imageUrl?: string;
}

export interface OrderInput {
  clientId: string;
  type: OrderType;
  items: OrderItemInput[];
  discount?: { type: 'AMOUNT' | 'PERCENT'; value: number; reason?: string } | null;
  /** Otros costos de la compra (p. ej. shipping de la tienda). */
  extraCharges?: number;
  extraChargesNote?: string;
  notes?: string;
  channel?: string;
}

function cleanItems(items: OrderItemInput[]) {
  if (!items || items.length === 0) throw new Error('Agrega al menos un producto');
  return items.map((i, idx) => {
    const name = i.name?.trim();
    const quantity = Math.floor(Number(i.quantity));
    const unitPrice = Number(i.unitPrice);
    if (!name) throw new Error(`El producto #${idx + 1} necesita una descripción`);
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`La cantidad de "${name}" debe ser al menos 1`);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`Ingresa el precio de "${name}"`);
    return {
      name,
      quantity,
      unitPrice,
      storeName: i.storeName?.trim() || null,
      url: i.url?.trim() || null,
      variant: i.variant?.trim() || null,
      notes: i.notes?.trim() || null,
      imageUrl: i.imageUrl?.trim() || null,
    };
  });
}

function cleanDiscount(d: OrderInput['discount']) {
  if (!d || !(d.value > 0)) return null;
  if (d.type === 'PERCENT' && d.value > 100) throw new Error('El descuento no puede superar el 100 %');
  return { type: d.type, value: d.value, reason: d.reason?.trim() || null };
}

const SERVICE_LABEL: Record<OrderType, string> = {
  PERSONAL_SHOPPER: 'Servicio Personal Shopper',
  CART: 'Servicio Compramos tu carrito',
};

function invoiceLines(
  type: OrderType,
  t: ReturnType<typeof computePurchase>,
  cfg: { taxRatePercent: number; serviceRatePercent: number; itemCount: number; extraNote?: string | null; discountReason?: string | null },
): InvoiceLineInput[] {
  const lines: InvoiceLineInput[] = [
    { kind: 'PRODUCTS', description: `Productos (${cfg.itemCount})`, amount: t.subtotal },
    { kind: 'TAX', description: `Tax ${cfg.taxRatePercent}%`, amount: t.tax },
    { kind: 'SERVICE_FEE', description: `${SERVICE_LABEL[type]} ${cfg.serviceRatePercent}%`, amount: t.serviceFee },
  ];
  if (t.extraCharges > 0) lines.push({ kind: 'EXTRA', description: cfg.extraNote || 'Otros costos de la compra', amount: t.extraCharges });
  if (t.discountAmount > 0) {
    lines.push({ kind: 'DISCOUNT', description: `Descuento${cfg.discountReason ? ` — ${cfg.discountReason}` : ''}`, amount: -t.discountAmount });
  }
  return lines;
}

function revalidateOrderPaths(orderId: string, clientId: string) {
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/pagos');
  revalidatePath('/compras');
  revalidatePath('/dashboard');
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath('/portal');
}

/**
 * Crea un pedido de Personal Shopper o de "Compramos tu carrito".
 * La tasa de servicio sale del perfil del cliente (PS) o de la configuración (Carrito);
 * el pedido genera una factura en la cuenta del cliente y queda PENDIENTE DE PAGO.
 */
export const createOrder = safe(async function createOrder(input: OrderInput) {
  const user = await requireStaff();
  const items = cleanItems(input.items);
  const discount = cleanDiscount(input.discount);
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new Error('Selecciona un cliente');

  const order = await inTransaction(async (tx) => {
    const baseRate = input.type === 'PERSONAL_SHOPPER' ? client.serviceFeePercent : settings.cartServiceRatePercent;
    // El beneficio por referido aplica solo a facturas de Personal Shopper.
    const available = input.type === 'PERSONAL_SHOPPER' ? await countAvailableBenefits(tx, client.id) : 0;
    const { rate, benefitApplied } = effectiveServiceRate(baseRate, available, settings.referralDiscountPoints);

    const totals = computePurchase({
      lines: items,
      taxRatePercent: settings.taxRatePercent,
      serviceRatePercent: rate,
      extraCharges: input.extraCharges,
      discount,
    });
    const number = await nextNumber(tx, tenantId, 'order');

    const created = await tx.order.create({
      data: {
        tenantId,
        clientId: client.id,
        number,
        type: input.type,
        channel: input.channel?.trim() || null,
        notes: input.notes?.trim() || null,
        taxRatePercent: settings.taxRatePercent,
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        baseServiceFeePercent: baseRate,
        serviceFeePercent: rate,
        serviceFeeAmount: totals.serviceFee,
        extraCharges: totals.extraCharges,
        extraChargesNote: input.extraChargesNote?.trim() || null,
        discountType: discount?.type ?? null,
        discountValue: discount?.value ?? null,
        discountAmount: totals.discountAmount,
        discountReason: discount?.reason ?? null,
        totalAmount: totals.total,
        products: {
          create: items.map((i) => ({
            tenantId,
            clientId: client.id,
            origin: input.type === 'PERSONAL_SHOPPER' ? ('PERSONAL_SHOPPER' as const) : ('CART' as const),
            status: 'PENDING_PAYMENT' as const,
            ...i,
          })),
        },
      },
    });

    if (benefitApplied) await consumeBenefit(tx, client.id, created.id);

    await createInvoice(tx, {
      tenantId,
      clientId: client.id,
      type: input.type,
      description: `Pedido #${String(number).padStart(3, '0')} — ${input.type === 'PERSONAL_SHOPPER' ? 'Personal Shopper' : 'Compramos tu carrito'}`,
      orderId: created.id,
      lines: invoiceLines(input.type, totals, {
        taxRatePercent: settings.taxRatePercent,
        serviceRatePercent: rate,
        itemCount: items.length,
        extraNote: input.extraChargesNote,
        discountReason: discount?.reason,
      }),
    });

    // Si el cliente tiene saldo a favor, se aplica solo.
    await reconcileClient(tx, client.id);
    await refreshOrder(tx, created.id);
    await audit(tx, {
      userName: user.name,
      action: 'order.create',
      entity: 'Order',
      entityId: created.id,
      data: { total: totals.total, rate, benefitApplied, discount: totals.discountAmount },
    });
    return created;
  });

  for (const i of items) await recordCatalogUsage(tenantId, { name: i.name, unitPrice: i.unitPrice });
  revalidateOrderPaths(order.id, client.id);
  revalidatePath('/productos');
  return { success: true, orderId: order.id };
});

/** Edita un pedido que todavía no tiene compras realizadas; recalcula todo y la factura. */
export const updateOrder = safe(async function updateOrder(orderId: string, input: Omit<OrderInput, 'clientId' | 'type'>) {
  const user = await requireStaff();
  const items = cleanItems(input.items);
  const discount = cleanDiscount(input.discount);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { products: { select: { status: true } }, invoice: { select: { id: true } }, benefitUsed: { select: { id: true } } },
  });
  if (!order) throw new Error('Pedido no encontrado');
  if (order.cancelledAt) throw new Error('El pedido está cancelado');
  if (order.products.some((p) => PRODUCT_STATUS_RANK[p.status] >= PRODUCT_STATUS_RANK.PURCHASED)) {
    throw new Error('No se puede editar: ya hay productos comprados');
  }
  await inTransaction(async (tx) => {
    // Se conserva la tasa con que se generó (incluido el beneficio de referido, si lo usó).
    const rate = order.serviceFeePercent;
    const totals = computePurchase({
      lines: items,
      taxRatePercent: order.taxRatePercent,
      serviceRatePercent: rate,
      extraCharges: input.extraCharges,
      discount,
    });

    await tx.product.deleteMany({ where: { orderId } });
    await tx.product.createMany({
      data: items.map((i) => ({
        tenantId: order.tenantId,
        clientId: order.clientId,
        orderId,
        origin: order.type === 'PERSONAL_SHOPPER' ? ('PERSONAL_SHOPPER' as const) : ('CART' as const),
        status: 'PENDING_PAYMENT' as const,
        ...i,
      })),
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        notes: input.notes?.trim() || null,
        channel: input.channel?.trim() || null,
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        serviceFeeAmount: totals.serviceFee,
        extraCharges: totals.extraCharges,
        extraChargesNote: input.extraChargesNote?.trim() || null,
        discountType: discount?.type ?? null,
        discountValue: discount?.value ?? null,
        discountAmount: totals.discountAmount,
        discountReason: discount?.reason ?? null,
        totalAmount: totals.total,
      },
    });

    if (order.invoice) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: order.invoice.id } });
      const lines = invoiceLines(order.type, totals, {
        taxRatePercent: order.taxRatePercent,
        serviceRatePercent: rate,
        itemCount: items.length,
        extraNote: input.extraChargesNote,
        discountReason: discount?.reason,
      });
      await tx.invoiceLine.createMany({
        data: lines.map((l, i) => ({ invoiceId: order.invoice!.id, kind: l.kind, description: l.description, amount: l.amount, sortOrder: i })),
      });
      await tx.invoice.update({ where: { id: order.invoice.id }, data: { total: totals.total } });
    }

    await reconcileClient(tx, order.clientId);
    await refreshOrder(tx, orderId);
    await audit(tx, { userName: user.name, action: 'order.update', entity: 'Order', entityId: orderId, data: { total: totals.total } });
  });

  for (const i of items) await recordCatalogUsage(order.tenantId, { name: i.name, unitPrice: i.unitPrice });
  revalidateOrderPaths(orderId, order.clientId);
  return { success: true };
});

/** Cancela un pedido sin compras: libera pagos aplicados y el beneficio de referido. */
export const cancelOrder = safe(async function cancelOrder(orderId: string, reason: string) {
  const user = await requireStaff();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { products: { select: { status: true } }, invoice: { select: { id: true } } },
  });
  if (!order) throw new Error('Pedido no encontrado');
  if (order.cancelledAt) throw new Error('El pedido ya está cancelado');
  if (order.products.some((p) => PRODUCT_STATUS_RANK[p.status] >= PRODUCT_STATUS_RANK.PURCHASED)) {
    throw new Error('No se puede cancelar: ya hay productos comprados');
  }

  await inTransaction(async (tx) => {
    await tx.product.updateMany({ where: { orderId }, data: { status: 'CANCELLED' } });
    await tx.order.update({
      where: { id: orderId },
      data: { cancelledAt: new Date(), cancelReason: reason?.trim() || null, status: 'CANCELLED' },
    });
    // El beneficio que usó el pedido vuelve a quedar disponible.
    await tx.referralBenefit.updateMany({
      where: { usedOrderId: orderId },
      data: { status: 'AVAILABLE', usedOrderId: null, usedAt: null },
    });
    if (order.invoice) {
      // El beneficio que habría generado esta compra se anula (un pedido cancelado no es compra válida).
      await tx.referralBenefit.updateMany({
        where: { sourceInvoiceId: order.invoice.id, status: 'AVAILABLE' },
        data: { status: 'VOIDED', voidedReason: 'Pedido cancelado' },
      });
      await cancelInvoice(tx, order.invoice.id);
    }
    await audit(tx, { userName: user.name, action: 'order.cancel', entity: 'Order', entityId: orderId, data: { reason } });
  });

  revalidateOrderPaths(orderId, order.clientId);
  return { success: true };
});

/**
 * Excepción al prepago (7.4): un administrador autoriza comprar sin el pago completo.
 * El valor no pagado queda como cargo pendiente en la cuenta del cliente.
 */
export const authorizeCourtesy = safe(async function authorizeCourtesy(orderId: string) {
  const user = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: { select: { status: true } } } });
  if (!order) throw new Error('Pedido no encontrado');
  if (order.cancelledAt) throw new Error('El pedido está cancelado');
  if (order.invoice?.status === 'PAID') throw new Error('El pedido ya está pagado');

  await inTransaction(async (tx: Prisma.TransactionClient) => {
    await tx.order.update({
      where: { id: orderId },
      data: { courtesyAuthorized: true, courtesyAuthorizedBy: user.name, courtesyAuthorizedAt: new Date() },
    });
    await refreshOrder(tx as Db, orderId);
    await audit(tx, { userName: user.name, action: 'order.courtesy', entity: 'Order', entityId: orderId });
  });

  revalidateOrderPaths(orderId, order.clientId);
  return { success: true };
});

export const revokeCourtesy = safe(async function revokeCourtesy(orderId: string) {
  const user = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { products: { select: { status: true } } } });
  if (!order) throw new Error('Pedido no encontrado');
  if (order.products.some((p) => PRODUCT_STATUS_RANK[p.status] >= PRODUCT_STATUS_RANK.PURCHASED)) {
    throw new Error('Ya hay productos comprados con esta autorización');
  }
  await inTransaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { courtesyAuthorized: false, courtesyAuthorizedBy: null, courtesyAuthorizedAt: null },
    });
    await refreshOrder(tx, orderId);
    await audit(tx, { userName: user.name, action: 'order.courtesy.revoke', entity: 'Order', entityId: orderId });
  });
  revalidateOrderPaths(orderId, order.clientId);
  return { success: true };
});

