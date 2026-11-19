/**
 * Prueba de punta a punta de las reglas del documento contra la base de desarrollo, ejecutando las
 * Server Actions reales (con sesión y correo simulados). Crea sus propios datos y los borra al final.
 *
 *   npm run e2e
 */
import assert from 'node:assert/strict';
import prisma from '@/lib/prisma';
import { createClient } from '@/app/actions/clients';
import { createOrder, cancelOrder, authorizeCourtesy } from '@/app/actions/orders';
import { approvePayment, registerPayment } from '@/app/actions/payments';
import { markProductsPurchased, receiveProducts, setProductPhoto, createCasilleroItems, registerCustodyPackage } from '@/app/actions/purchasing';
import { closeConsolidation, setConsolidationWeight, setConsolidationDecision } from '@/app/actions/consolidations';
import {
  addPkgsToDispatch, assignProductsToPkg, closePkg, confirmDispatch, confirmProductsArrived, createDispatch, createPkg,
  deletePkg, markProductsDelivered, receivePkgsAtDestination, updatePkgInfo,
} from '@/app/actions/logistics';
import {
  createConsignee, createGuide, createGuideIdentifier, createShipper, deleteConsignee, deleteGuideIdentifier,
  deleteShipper, generatePkgGuide, registerGuidePrints, setGuideIdentifierActive, setGuideStatus, updateGuide, voidGuide,
} from '@/app/actions/guides';
import { getLabelData } from '@/lib/guides';
import { setCustodyActive, deliverCustodyPackages } from '@/app/actions/custody';
import { portalSetDecision, portalSubmitTransfer } from '@/app/actions/portal';
import { rejectAccessRequest, requestPortalAccess } from '@/app/actions/access';
import { confirmCardCheckout, createCardCheckout } from '@/app/actions/cardPayments';
import { verifyWebhookSignature } from '@/lib/square';
import { createHmac } from 'node:crypto';
import { getClientAccount, getStatement } from '@/lib/accounting';
import { runningBalances } from '@/lib/domain/ledger';

type Res = { ok: true } | { ok: false; error: string };
const created = { clients: [] as string[], pkgs: [] as string[], dispatches: [] as string[], shippers: [] as string[], identifiers: [] as string[] };
let passed = 0;
// La prueba asume las reglas de Panamá del documento; si Configuraciones las cambió, las fija y las devuelve al terminar.
let panamaRuleBackup: { id: string; allowDispatchWithBalance: boolean; usesDeconsolidation: boolean } | null = null;
let counterBackup: { tenantId: string; key: string; value: number }[] | null = null;
let cutoffBackup: { tenantId: string; value: Date | null } | null = null;
async function restoreConfig() {
  if (panamaRuleBackup) {
    const { id, ...data } = panamaRuleBackup;
    await prisma.countryRule.update({ where: { id }, data });
    panamaRuleBackup = null;
  }
  if (counterBackup) {
    // Los consecutivos (clientes, pedidos, facturas) vuelven a donde estaban: la prueba no debe gastar números reales.
    await prisma.counter.deleteMany({});
    if (counterBackup.length) await prisma.counter.createMany({ data: counterBackup });
    counterBackup = null;
  }
  if (cutoffBackup) {
    await prisma.tenantSettings.update({ where: { tenantId: cutoffBackup.tenantId }, data: { dispatchCutoffAt: cutoffBackup.value } });
    cutoffBackup = null;
  }
}

function ok<T extends Res>(res: T, label: string): Extract<T, { ok: true }> {
  if (!res.ok) throw new Error(`${label}: ${(res as { error: string }).error}`);
  return res as Extract<T, { ok: true }>;
}
function blocked(res: Res, includes: string, label: string) {
  assert.equal(res.ok, false, `${label}: se esperaba que fuera rechazado`);
  assert.match((res as { error: string }).error, new RegExp(includes, 'i'), label);
}
function step(name: string) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Ficha de cliente: la fecha de nacimiento es obligatoria al crear. */
const clientForm = (entries: Record<string, string>) => form({ birthdayMonth: '5', birthdayDay: '14', ...entries });

async function cleanup() {
  // Guías de prueba: las IFL se borran por remitente; las de PKG se van con su PKG (en cascada).
  if (created.shippers.length) {
    await prisma.guide.deleteMany({ where: { shipperId: { in: created.shippers } } });
    await prisma.consignee.deleteMany({ where: { shipperId: { in: created.shippers } } });
    await prisma.shipper.deleteMany({ where: { id: { in: created.shippers } } });
  }
  if (created.identifiers.length) {
    await prisma.guide.deleteMany({ where: { refPrefix: { in: created.identifiers } } });
    await prisma.guideIdentifier.deleteMany({ where: { prefix: { in: created.identifiers } } });
  }
  const ids = created.clients;
  if (ids.length === 0) return;
  await prisma.cardCheckout.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.paymentAllocation.deleteMany({ where: { payment: { clientId: { in: ids } } } });
  await prisma.payment.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.referralBenefit.deleteMany({ where: { OR: [{ referrerId: { in: ids } }, { referredId: { in: ids } }] } });
  await prisma.product.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.custodyPackage.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.invoice.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.consolidation.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.order.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.pkg.deleteMany({ where: { id: { in: created.pkgs } } });
  await prisma.dispatch.deleteMany({ where: { id: { in: created.dispatches } } });
  await prisma.client.updateMany({ where: { id: { in: ids } }, data: { referredById: null } });
  await prisma.client.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();
  counterBackup = (await prisma.counter.findMany()).map((c) => ({ tenantId: c.tenantId, key: c.key, value: c.value }));
  const rule = await prisma.countryRule.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'Panamá' } });
  panamaRuleBackup = { id: rule.id, allowDispatchWithBalance: rule.allowDispatchWithBalance, usesDeconsolidation: rule.usesDeconsolidation };
  await prisma.countryRule.update({ where: { id: rule.id }, data: { allowDispatchWithBalance: false, usesDeconsolidation: false } });
  // El cierre semanal debe estar abierto para probar la decisión del cliente desde el portal.
  const cfg = await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  cutoffBackup = { tenantId: tenant.id, value: cfg.dispatchCutoffAt };
  await prisma.tenantSettings.update({ where: { tenantId: tenant.id }, data: { dispatchCutoffAt: new Date(Date.now() + 7 * 86_400_000) } });
  const general = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Ecuador General' } });
  const emprendedor = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Ecuador Emprendedores' } });
  const panama = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Panamá' } });
  const stamp = Date.now().toString().slice(-6);

  console.log('Etapa 1 — clientes');
  const aRes = ok(await createClient(clientForm({ name: `E2E Ana ${stamp}`, phone: '+593 99 000 0001', country: 'Ecuador', city: 'Quito', serviceFeePercent: '20', shippingCategoryId: general.id })), 'crear Ana');
  created.clients.push(aRes.clientId);
  assert.match(aRes.code, /^EC\d{3,}$/);
  step(`código automático ${aRes.code}`);
  const bRes = ok(await createClient(clientForm({ name: `E2E Beto ${stamp}`, phone: '+593 99 000 0002', country: 'Ecuador', city: 'Cuenca', serviceFeePercent: '10', shippingCategoryId: general.id, referredById: aRes.clientId })), 'crear Beto');
  created.clients.push(bRes.clientId);
  assert.notEqual(aRes.code, bRes.code);
  step(`códigos únicos y consecutivos (${aRes.code}, ${bRes.code})`);
  blocked(await createClient(form({ name: 'X', phone: '1', country: 'Ecuador', shippingCategoryId: general.id })), 'nacimiento', 'fecha de nacimiento obligatoria al crear');
  step('la fecha de nacimiento es obligatoria al crear el cliente');
  blocked(await createClient(clientForm({ name: 'X', phone: '1', country: 'Ecuador', shippingCategoryId: panama.id })), 'no corresponde al país', 'tarifa de otro país');
  step('la tarifa debe corresponder al país del cliente');
  const pRes = ok(await createClient(clientForm({ name: `E2E Pía ${stamp}`, phone: '+507 6000 0003', country: 'Panamá', city: 'Ciudad de Panamá', serviceFeePercent: '20', shippingCategoryId: panama.id })), 'crear Pía');
  created.clients.push(pRes.clientId);
  assert.match(pRes.code, /^PTY\d{3,}$/);
  step(`prefijo por país (${pRes.code})`);

  console.log('Etapa 2 — pedido Personal Shopper de Beto (cliente al 10 %)');
  const items = [
    { name: 'Zapatos', quantity: 1, unitPrice: 5 },
    { name: 'Correa', quantity: 1, unitPrice: 5 },
    { name: 'Blusa', quantity: 1, unitPrice: 5 },
  ];
  const o1 = ok(await createOrder({ clientId: bRes.clientId, type: 'PERSONAL_SHOPPER', items }), 'pedido Beto');
  const order1 = await prisma.order.findUniqueOrThrow({ where: { id: o1.orderId }, include: { invoice: true, products: true } });
  assert.equal(order1.subtotal, 15);
  assert.equal(order1.taxAmount, 0.98);
  assert.equal(order1.serviceFeeAmount, 1.6);
  assert.equal(order1.totalAmount, 17.58);
  assert.equal(order1.invoice?.total, 17.58);
  assert.equal(order1.status, 'PENDING_PAYMENT');
  assert.ok(order1.products.every((p) => p.status === 'PENDING_PAYMENT'));
  step('15 + tax 0.98 + servicio 10 % (1.60) = 17.58, pendiente de pago');

  blocked(await markProductsPurchased(order1.products.map((p) => p.id)), 'listos para comprar', 'compra sin pago');
  step('no se puede comprar sin pago aprobado');

  console.log('Etapa 7 — comprobante del cliente → aprobación → pago aplicado');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = { kind: 'portal', id: bRes.clientId, name: 'Beto', email: 'b@test.local' };
  ok(await portalSubmitTransfer({ amount: 20, proofPath: '2026/e2e-proof.jpg', targetInvoiceId: order1.invoice!.id, reference: 'T-1' }), 'transferencia del cliente');
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o1.orderId } })).status, 'PAYMENT_REVIEW');
  step('comprobante subido: PENDIENTE DE PAGO → PAGO POR VERIFICAR (sigue sin autorizar compra)');
  const pending = await prisma.payment.findFirstOrThrow({ where: { clientId: bRes.clientId, status: 'PENDING_VERIFICATION' } });
  ok(await approvePayment(pending.id), 'aprobar pago');
  const afterPay = await prisma.order.findUniqueOrThrow({ where: { id: o1.orderId }, include: { products: true, invoice: true } });
  assert.equal(afterPay.invoice?.status, 'PAID');
  assert.equal(afterPay.status, 'READY_TO_BUY');
  assert.ok(afterPay.products.every((p) => p.status === 'READY_TO_BUY'));
  let acc = await getClientAccount(prisma, bRes.clientId);
  assert.equal(acc.credit, 2.42);
  step('pago de $20 cubre $17.58 y deja $2.42 a favor automáticamente');

  console.log('Referidos — el primer pedido pagado de Beto genera 1 beneficio para Ana');
  const benefit = await prisma.referralBenefit.findFirstOrThrow({ where: { referrerId: aRes.clientId } });
  assert.equal(benefit.status, 'AVAILABLE');
  step('beneficio generado al aprobarse la primera compra válida');

  console.log('Etapa 2.11 / 3 — compra por producto y recepción');
  ok(await markProductsPurchased([afterPay.products[0].id, afterPay.products[1].id]), 'comprar 2 productos');
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o1.orderId } })).status, 'PARTIALLY_PURCHASED');
  step('se puede comprar parte del pedido');
  ok(await markProductsPurchased([afterPay.products[2].id]), 'comprar el 3.º');
  blocked(await receiveProducts(afterPay.products.map((p) => p.id)), 'foto', 'recibir sin foto');
  step('la foto es obligatoria para recibir');
  for (const p of afterPay.products) ok(await setProductPhoto(p.id, `https://example.test/${p.id}.jpg`), 'foto');
  ok(await receiveProducts(afterPay.products.map((p) => p.id)), 'recibir');
  let cons = await prisma.consolidation.findFirstOrThrow({ where: { clientId: bRes.clientId, status: 'OPEN' }, include: { products: true } });
  assert.equal(cons.products.length, 3);
  step('productos recibidos pasan solos al consolidado abierto');

  console.log('Etapa 4 — Casillero (misma consolidación)');
  blocked(await createCasilleroItems(bRes.clientId, [{ name: 'Vitaminas', quantity: 1, imageUrl: '' }]), 'foto', 'casillero sin foto');
  ok(await createCasilleroItems(bRes.clientId, [{ name: 'Tablet', quantity: 2, imageUrl: 'https://example.test/t.jpg' }]), 'casillero');
  cons = await prisma.consolidation.findFirstOrThrow({ where: { clientId: bRes.clientId, status: 'OPEN' }, include: { products: true } });
  assert.equal(cons.products.length, 4);
  assert.equal(await prisma.consolidation.count({ where: { clientId: bRes.clientId, status: 'OPEN' } }), 1);
  assert.ok(cons.products.some((p) => p.origin === 'CASILLERO'));
  step('Casillero exige foto y entra al MISMO consolidado (un solo consolidado abierto)');

  console.log('Etapa 3 — peso, retención y cierre');
  ok(await setConsolidationWeight(cons.id, 2.8), 'peso 2.8');
  ok(await setConsolidationWeight(cons.id, 6.37), 'peso 6.37 (se reemplaza)');
  ok(await setConsolidationDecision(cons.id, 'HOLD'), 'retener');
  const held = await prisma.consolidation.findUniqueOrThrow({ where: { id: cons.id } });
  assert.equal(held.realWeight, 6.37);
  assert.ok(held.retentionStartedAt);
  const startedAt = held.retentionStartedAt!.getTime();
  ok(await createCasilleroItems(bRes.clientId, [{ name: 'Libro', quantity: 1, imageUrl: 'https://example.test/l.jpg' }]), 'producto nuevo durante retención');
  assert.equal((await prisma.consolidation.findUniqueOrThrow({ where: { id: cons.id } })).retentionStartedAt!.getTime(), startedAt);
  step('el peso es editable y los productos nuevos NO reinician la fecha de retención');
  ok(await setConsolidationDecision(cons.id, 'DISPATCH'), 'despachar');
  ok(await closeConsolidation(cons.id), 'cerrar consolidado');
  blocked(await closeConsolidation(cons.id), 'ya está cerrado', 'cerrar dos veces');
  const closedCheck = await prisma.consolidation.findUniqueOrThrow({ where: { id: cons.id }, include: { invoice: true } });
  assert.equal(closedCheck.status, 'CLOSED');
  assert.equal(closedCheck.billableWeight, 6.5);
  assert.equal(closedCheck.shippingCost, 48.75);
  assert.equal(closedCheck.invoice?.total, 48.75);
  step('cierre: 6.37 lb → 6.5 lb × $7.50 = $48.75 (peso, tarifa y valor congelados)');
  acc = await getClientAccount(prisma, bRes.clientId);
  assert.equal(acc.credit, 0);
  assert.equal(closedCheck.invoice?.paidAmount, 2.42);
  assert.equal(acc.pending, 46.33);
  step('el saldo a favor de $2.42 se aplicó solo a la factura de despacho (pendiente $46.33)');

  console.log('Etapa 8 — PKG, despacho, Ecuador');
  const pkg = ok(await createPkg({ country: 'Ecuador' }), 'crear PKG');
  created.pkgs.push(pkg.pkgId);
  const pool = await prisma.product.findMany({ where: { clientId: bRes.clientId, status: 'RECEIVED', pkgId: null } });
  assert.equal(pool.length, 5);
  ok(await assignProductsToPkg(pkg.pkgId, pool.map((p) => p.id)), 'asignar al PKG (Ecuador despacha con saldo)');
  ok(await closePkg(pkg.pkgId), 'cerrar PKG');
  const dsp = ok(await createDispatch({ country: 'Ecuador', date: new Date().toISOString().slice(0, 10) }), 'crear despacho');
  created.dispatches.push(dsp.dispatchId);
  ok(await addPkgsToDispatch(dsp.dispatchId, [pkg.pkgId]), 'agregar PKG al despacho');
  assert.equal((await prisma.product.findFirstOrThrow({ where: { pkgId: pkg.pkgId } })).status, 'RECEIVED');
  step('asignar a un PKG NO pone el producto en tránsito');
  ok(await confirmDispatch(dsp.dispatchId), 'confirmar despacho');
  assert.ok((await prisma.product.findMany({ where: { pkgId: pkg.pkgId } })).every((p) => p.status === 'IN_TRANSIT'));
  step('al confirmar el despacho todos los productos pasan a EN TRÁNSITO');

  console.log('Etapa 8.18 — desconsolidación y entrega con saldo');
  ok(await receivePkgsAtDestination([pkg.pkgId]), 'recibir PKG');
  ok(await confirmProductsArrived(pool.map((p) => p.id)), 'confirmar productos');
  assert.ok((await prisma.product.findMany({ where: { pkgId: pkg.pkgId } })).every((p) => p.status === 'READY_FOR_PICKUP'));
  blocked(await markProductsDelivered(pool.map((p) => p.id)), 'saldo pendiente', 'entrega con saldo');
  step('NO ENTREGAR: Ecuador despacha con saldo pero no entrega con saldo');
  ok(await registerPayment({ clientId: bRes.clientId, amount: 50, method: 'TRANSFER' }), 'pago $50');
  acc = await getClientAccount(prisma, bRes.clientId);
  assert.equal(acc.pending, 0);
  assert.equal(acc.credit, 3.67);
  ok(await markProductsDelivered(pool.map((p) => p.id)), 'entregar');
  step('pago de $50 liquida $46.33, deja $3.67 a favor y habilita la entrega');

  console.log('Estado de cuenta');
  const rows = await getStatement(prisma, bRes.clientId);
  const last = rows[rows.length - 1];
  assert.equal(last.balance, -3.67);
  assert.equal(runningBalances([{ date: new Date(), charge: 0, credit: 0 }]).length, 1);
  step('historial cronológico con saldo corrido (termina en −$3.67 = a favor)');

  console.log('Referidos — beneficio de Ana en su siguiente factura de Personal Shopper');
  const o2 = ok(await createOrder({ clientId: aRes.clientId, type: 'PERSONAL_SHOPPER', items: [{ name: 'Perfume', quantity: 1, unitPrice: 100 }] }), 'pedido Ana');
  const order2 = await prisma.order.findUniqueOrThrow({ where: { id: o2.orderId }, include: { benefitUsed: true } });
  assert.equal(order2.serviceFeePercent, 15);
  assert.equal(order2.baseServiceFeePercent, 20);
  assert.ok(order2.benefitUsed);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: aRes.clientId } })).serviceFeePercent, 20);
  step('tasa 20 % → 15 % en UNA factura; la tasa habitual no cambia');
  ok(await cancelOrder(o2.orderId, 'prueba'), 'cancelar');
  assert.equal((await prisma.referralBenefit.findFirstOrThrow({ where: { referrerId: aRes.clientId } })).status, 'AVAILABLE');
  step('cancelar el pedido devuelve el beneficio');
  const o3 = ok(await createOrder({ clientId: aRes.clientId, type: 'PERSONAL_SHOPPER', items: [{ name: 'Reloj', quantity: 1, unitPrice: 50 }], discount: { type: 'AMOUNT', value: 2, reason: 'Cortesía' } }), 'pedido Ana con descuento');
  const order3 = await prisma.order.findUniqueOrThrow({ where: { id: o3.orderId } });
  assert.equal(order3.discountAmount, 2);
  assert.equal(order3.discountReason, 'Cortesía');
  step('descuento en dólares con motivo queda registrado en el pedido');
  await authorizeCourtesy(o3.orderId);
  const courtesy = await prisma.order.findUniqueOrThrow({ where: { id: o3.orderId }, include: { products: true, invoice: true } });
  assert.equal(courtesy.status, 'READY_TO_BUY');
  assert.equal(courtesy.invoice?.status, 'PENDING');
  step('compra a crédito autorizada: se puede comprar y el valor queda pendiente en la cuenta');

  console.log('Etapa 5 — Compramos tu carrito (10 % configurable)');
  const o4 = ok(await createOrder({ clientId: aRes.clientId, type: 'CART', items: [{ name: 'Carrito Amazon', quantity: 1, unitPrice: 100 }] }), 'carrito');
  const cart = await prisma.order.findUniqueOrThrow({ where: { id: o4.orderId } });
  assert.equal(cart.taxAmount, 6.5);
  assert.equal(cart.serviceFeeAmount, 10.65);
  assert.equal(cart.totalAmount, 117.15);
  assert.equal(cart.serviceFeePercent, 10);
  step('$100 + $6.50 tax + 10 % = $117.15 (sin usar el beneficio de referido)');

  console.log('Panamá — pago completo antes de despachar');
  ok(await registerPayment({ clientId: pRes.clientId, amount: 5, method: 'CASH' }), 'saldo a favor previo');
  const o5 = ok(await createOrder({ clientId: pRes.clientId, type: 'PERSONAL_SHOPPER', items: [{ name: 'Bolso', quantity: 1, unitPrice: 10 }] }), 'pedido Pía');
  const op = await prisma.order.findUniqueOrThrow({ where: { id: o5.orderId }, include: { products: true, invoice: true } });
  ok(await registerPayment({ clientId: pRes.clientId, amount: op.totalAmount, method: 'CASH', targetInvoiceId: op.invoice!.id }), 'pagar pedido');
  ok(await markProductsPurchased(op.products.map((p) => p.id)), 'comprar');
  await prisma.product.updateMany({ where: { orderId: o5.orderId }, data: { imageUrl: 'https://example.test/b.jpg' } });
  ok(await receiveProducts(op.products.map((p) => p.id)), 'recibir');
  const pc = await prisma.consolidation.findFirstOrThrow({ where: { clientId: pRes.clientId, status: 'OPEN' } });
  ok(await setConsolidationWeight(pc.id, 2.2), 'peso Pía');
  ok(await closeConsolidation(pc.id), 'cerrar Pía');
  const pInv = await prisma.invoice.findFirstOrThrow({ where: { clientId: pRes.clientId, type: 'SHIPPING' } });
  assert.equal(pInv.total, 13.75);
  step('Panamá: 2.2 lb → 2.5 lb × $5.50 = $13.75');
  const pkgP = ok(await createPkg({ country: 'Panamá' }), 'PKG Panamá');
  created.pkgs.push(pkgP.pkgId);
  const pProduct = await prisma.product.findFirstOrThrow({ where: { clientId: pRes.clientId, status: 'RECEIVED' } });
  blocked(await assignProductsToPkg(pkgP.pkgId, [pProduct.id]), 'no está autorizado para despacho', 'Panamá con saldo');
  step('Panamá con factura de despacho pendiente: NO AUTORIZADO PARA DESPACHO');
  ok(await registerPayment({ clientId: pRes.clientId, amount: 20, method: 'CASH' }), 'pagar despacho');
  ok(await assignProductsToPkg(pkgP.pkgId, [pProduct.id]), 'asignar tras pagar');
  step('al pagar la factura completa queda AUTORIZADO PARA DESPACHO');

  console.log('Portal — decisión de retención');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = { kind: 'portal', id: aRes.clientId, name: 'Ana', email: 'a@test.local' };
  ok(await createCasilleroItems(aRes.clientId, [{ name: 'Gorra', quantity: 1, imageUrl: 'https://example.test/g.jpg' }]), 'producto Ana');
  const ac = await prisma.consolidation.findFirstOrThrow({ where: { clientId: aRes.clientId, status: 'OPEN' } });
  ok(await portalSetDecision(ac.id, 'HOLD'), 'retener desde el portal');
  assert.equal((await prisma.consolidation.findUniqueOrThrow({ where: { id: ac.id } })).decision, 'HOLD');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = { kind: 'portal', id: bRes.clientId, name: 'Beto', email: 'b@test.local' };
  blocked(await portalSetDecision(ac.id, 'DISPATCH'), 'no encontrado', 'consolidado ajeno');
  step('el cliente solo puede decidir sobre SU consolidado');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = undefined;

  console.log('Etapa 9 — Custodio');
  blocked(await registerCustodyPackage({ clientId: aRes.clientId, size: 'SMALL' }), 'no tiene el servicio de Custodio', 'custodio apagado');
  step('el servicio está apagado por defecto');
  ok(await setCustodyActive(aRes.clientId, true, '2026-12-31'), 'activar custodio');
  ok(await registerCustodyPackage({ clientId: aRes.clientId, size: 'MEDIUM', storeNote: 'Amazon' }), 'paquete medium');
  ok(await registerCustodyPackage({ clientId: aRes.clientId, size: 'LARGE' }), 'paquete large');
  const cp = await prisma.custodyPackage.findMany({ where: { clientId: aRes.clientId }, orderBy: { fee: 'asc' } });
  assert.deepEqual(cp.map((c) => c.fee), [4, 5]);
  const del = ok(await deliverCustodyPackages({ clientId: aRes.clientId, packageIds: cp.map((c) => c.id), method: 'DELIVERY', miles: 8 }), 'delivery');
  assert.equal(del.fee, 19.5);
  step('Medium $4, Large $5; delivery de 8 millas = $15 + 3 × $1.50 = $19.50 en su cuenta');

  console.log('Tarifa Emprendedores — libra completa');
  const cEmp = ok(await createClient(clientForm({ name: `E2E Emi ${stamp}`, phone: '+593 99 000 0004', country: 'Ecuador', serviceFeePercent: '20', shippingCategoryId: emprendedor.id })), 'Emi');
  created.clients.push(cEmp.clientId);
  ok(await createCasilleroItems(cEmp.clientId, [{ name: 'Mercadería', quantity: 3, imageUrl: 'https://example.test/m.jpg' }]), 'Emi casillero');
  const ec = await prisma.consolidation.findFirstOrThrow({ where: { clientId: cEmp.clientId, status: 'OPEN' } });
  ok(await setConsolidationWeight(ec.id, 8.2), 'peso 8.2');
  ok(await closeConsolidation(ec.id), 'cerrar');
  const einv = await prisma.consolidation.findUniqueOrThrow({ where: { id: ec.id } });
  assert.equal(einv.billableWeight, 9);
  assert.equal(einv.shippingCost, 48.69);
  step('8.2 lb → 9 lb × $5.41 = $48.69');

  console.log('Acceso al portal — un correo, un código, cada cliente ve solo lo suyo');
  const staffEmail = (await prisma.user.findFirstOrThrow()).email;
  const mail = (n: string) => `e2e-${n}-${stamp}@test.local`;
  const codeAsTyped = aRes.code.replace(/^([A-Z]+)0*/, (_m, p: string) => `${p.toLowerCase()} `); // "ec 4xx"
  blocked(await requestPortalAccess(form({ code: 'EC999999', email: mail('x'), phone: '+593 99 000 0001' })), 'No encontramos ese código', 'código inexistente');
  blocked(await requestPortalAccess(form({ code: codeAsTyped, email: 'no-es-correo', phone: '+593 99 000 0001' })), 'correo válido', 'correo inválido');
  blocked(await requestPortalAccess(form({ code: codeAsTyped, email: staffEmail, phone: '+593 99 000 0001' })), 'equipo', 'correo de staff');
  step('código inexistente, correo inválido y correo del equipo son rechazados');
  ok(await requestPortalAccess(form({ code: codeAsTyped, email: mail('ana'), phone: '+593 99 000 0001' })), 'solicitud de Ana');
  const reqAna = await prisma.accessRequest.findFirstOrThrow({ where: { clientId: aRes.clientId } });
  assert.equal(reqAna.status, 'PENDING');
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: aRes.clientId } })).email, null);
  step('"ec 4xx" se reconoce como el código; la solicitud queda PENDIENTE y no liga ningún correo');
  blocked(await requestPortalAccess(form({ code: aRes.code, email: mail('ana2'), phone: '+593 99 000 0001' })), 'en revisión', 'segunda solicitud del mismo código');
  blocked(await requestPortalAccess(form({ code: bRes.code, email: mail('ana'), phone: '+593 99 000 0002' })), 'en una solicitud', 'mismo correo en otro código');
  step('un código no puede tener dos solicitudes abiertas ni un correo repetirse entre códigos');
  ok(await rejectAccessRequest(reqAna.id, 'prueba'), 'rechazar');
  assert.equal((await prisma.accessRequest.findUniqueOrThrow({ where: { id: reqAna.id } })).status, 'REJECTED');
  blocked(await rejectAccessRequest(reqAna.id), 'ya fue atendida', 'rechazar dos veces');
  step('rechazar no da acceso y no se puede atender dos veces');
  await prisma.client.update({ where: { id: bRes.clientId }, data: { email: mail('beto') } });
  blocked(await requestPortalAccess(form({ code: bRes.code, email: mail('otro'), phone: '+593 99 000 0002' })), 'ya tiene un correo registrado', 'código con correo');
  blocked(await createClient(clientForm({ name: 'Dup', phone: '1', country: 'Ecuador', email: mail('beto') })), 'otro cliente', 'correo repetido al crear cliente');
  blocked(await createClient(clientForm({ name: 'Dup', phone: '1', country: 'Ecuador', email: staffEmail })), 'equipo', 'correo de staff al crear cliente');
  step('un código con correo ligado no admite otro; el correo no se repite entre clientes ni con el equipo');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = { kind: 'portal', id: aRes.clientId, name: 'Ana', email: mail('ana') };
  blocked(await portalSubmitTransfer({ amount: 5, proofPath: '2026/x.jpg', targetInvoiceId: order1.invoice!.id }), 'Factura inválida', 'pagar factura ajena');
  blocked(await portalSetDecision(ec.id, 'HOLD'), 'no encontrado', 'decidir sobre consolidado ajeno');
  (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = undefined;
  step('un cliente no puede pagar facturas ni decidir sobre consolidados de otro cliente');

  console.log('Pago con tarjeta (Square) — se cobra una vez, solo lo confirmado por Square y solo lo del cliente');
  process.env.SQUARE_ACCESS_TOKEN = 'test-token';
  process.env.SQUARE_LOCATION_ID = 'L-TEST';
  process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'webhook-key';
  const realFetch = globalThis.fetch;
  type FakeOrder = { state: string; total_money: { amount: number; currency: string }; net_amount_due_money: { amount: number }; tenders: { id: string; payment_id: string }[] };
  const squareOrders = new Map<string, FakeOrder>();
  let squareSeq = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes('squareup')) return realFetch(input, init);
    const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/v2/online-checkout/payment-links')) {
      const sent = JSON.parse(String(init?.body)) as { order: { line_items: { base_price_money: { amount: number } }[] } };
      const orderId = `ORD-${stamp}-${++squareSeq}`;
      squareOrders.set(orderId, { state: 'OPEN', total_money: { amount: sent.order.line_items[0].base_price_money.amount, currency: 'USD' }, net_amount_due_money: { amount: sent.order.line_items[0].base_price_money.amount }, tenders: [] });
      return reply({ payment_link: { id: `PL-${squareSeq}`, url: `https://square.test/pay/${orderId}`, order_id: orderId } });
    }
    const orderId = decodeURIComponent(url.split('/v2/orders/')[1]);
    return reply({ order: squareOrders.get(orderId) });
  }) as typeof fetch;
  const squarePay = (orderId: string, cents?: number) => {
    const o = squareOrders.get(orderId)!;
    if (cents !== undefined) o.total_money.amount = cents;
    o.state = 'COMPLETED';
    o.net_amount_due_money.amount = 0;
    o.tenders = [{ id: `TND-${orderId}`, payment_id: `PAY-${orderId}` }];
  };
  const setPortal = (c: { id: string; name: string; email: string } | undefined) => {
    (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = c ? { kind: 'portal', ...c } : undefined;
  };

  const cCard = ok(await createClient(clientForm({ name: `E2E Carla ${stamp}`, phone: '+593 99 000 0005', country: 'Ecuador', city: 'Cuenca', serviceFeePercent: '20', shippingCategoryId: general.id })), 'Carla');
  created.clients.push(cCard.clientId);
  const oCard = ok(await createOrder({ clientId: cCard.clientId, type: 'PERSONAL_SHOPPER', items: [{ name: 'Bolso', quantity: 1, unitPrice: 40 }] }), 'pedido Carla');
  const invCard = (await prisma.order.findUniqueOrThrow({ where: { id: oCard.orderId }, include: { invoice: true } })).invoice!;
  setPortal({ id: cCard.clientId, name: 'Carla', email: 'carla@test.local' });
  blocked(await createCardCheckout({ amount: 0.5 }), 'mínimo', 'monto menor a $1');
  blocked(await createCardCheckout({ amount: invCard.total + 1 }), 'mayor a lo que debes', 'monto mayor al saldo');
  blocked(await createCardCheckout({ amount: 5, targetInvoiceId: order1.invoice!.id }), 'Factura inválida', 'tarjeta sobre factura ajena');
  step('la tarjeta rechaza montos menores a $1, mayores a la deuda y facturas de otro cliente');

  const half = Math.round(invCard.total * 50) / 100;
  const c1 = ok(await createCardCheckout({ amount: half, targetInvoiceId: invCard.id }), 'checkout 1');
  assert.match(c1.url, /^https:\/\/square\.test\/pay\/ORD-/);
  const row1 = await prisma.cardCheckout.findFirstOrThrow({ where: { clientId: cCard.clientId }, orderBy: { createdAt: 'asc' } });
  assert.equal(row1.status, 'CREATED');
  assert.equal(await prisma.payment.count({ where: { clientId: cCard.clientId } }), 0);
  step('crear el enlace de Square NO registra ningún pago todavía');

  assert.equal(ok(await confirmCardCheckout(row1.id), 'confirmar sin pagar').outcome, 'PENDING');
  squarePay(row1.squareOrderId!, Math.round(half * 100) - 1); // Square dice que se cobró menos de lo pedido
  assert.equal(ok(await confirmCardCheckout(row1.id), 'confirmar monto distinto').outcome, 'PENDING');
  assert.equal(await prisma.payment.count({ where: { clientId: cCard.clientId } }), 0);
  step('sin cobro en Square, o con un monto distinto al pedido, no se registra el pago');

  setPortal({ id: aRes.clientId, name: 'Ana', email: 'ana@test.local' });
  blocked(await confirmCardCheckout(row1.id), 'no encontrado', 'confirmar el pago de otro cliente');
  setPortal({ id: cCard.clientId, name: 'Carla', email: 'carla@test.local' });
  squarePay(row1.squareOrderId!, Math.round(half * 100));
  const [r1, r2] = await Promise.all([confirmCardCheckout(row1.id), confirmCardCheckout(row1.id)]);
  assert.equal(ok(r1, 'confirmar 1').outcome, 'PAID');
  assert.equal(ok(r2, 'confirmar 2').outcome, 'PAID');
  assert.equal(ok(await confirmCardCheckout(row1.id), 'confirmar 3').outcome, 'PAID');
  const cardPayments = await prisma.payment.findMany({ where: { clientId: cCard.clientId } });
  assert.equal(cardPayments.length, 1);
  assert.equal(cardPayments[0].method, 'CARD');
  assert.equal(cardPayments[0].status, 'APPROVED');
  assert.equal(cardPayments[0].amount, half);
  assert.equal(cardPayments[0].reference, `PAY-${row1.squareOrderId}`);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invCard.id } })).paidAmount, half);
  step(`cobro confirmado: un solo pago de tarjeta por $${half.toFixed(2)} aunque se confirme tres veces a la vez`);

  const accCard = await getClientAccount(prisma, cCard.clientId);
  assert.equal(Math.round(accCard.pending * 100), Math.round((invCard.total - half) * 100));
  const c2 = ok(await createCardCheckout({ amount: accCard.pending }), 'checkout 2');
  assert.ok(c2.url);
  const row2 = await prisma.cardCheckout.findFirstOrThrow({ where: { clientId: cCard.clientId, status: 'CREATED' } });
  squarePay(row2.squareOrderId!);
  assert.equal(ok(await confirmCardCheckout(row2.id), 'confirmar 2º pago').outcome, 'PAID');
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invCard.id } })).status, 'PAID');
  assert.equal((await getClientAccount(prisma, cCard.clientId)).pending, 0);
  blocked(await createCardCheckout({ amount: 5 }), 'no tienes saldo pendiente', 'tarjeta sin deuda');
  step('el segundo pago cierra la factura y, sin deuda, ya no se puede pagar con tarjeta');
  setPortal(undefined);

  const body = JSON.stringify({ type: 'payment.updated', data: { object: { payment: { order_id: row2.squareOrderId } } } });
  const url = 'https://app.test/api/square/webhook';
  const goodSig = createHmac('sha256', 'webhook-key').update(url + body).digest('base64');
  assert.equal(verifyWebhookSignature({ body, signature: goodSig, url, key: 'webhook-key' }), true);
  assert.equal(verifyWebhookSignature({ body: body + ' ', signature: goodSig, url, key: 'webhook-key' }), false);
  assert.equal(verifyWebhookSignature({ body, signature: goodSig, url: 'https://otro.test/api/square/webhook', key: 'webhook-key' }), false);
  assert.equal(verifyWebhookSignature({ body, signature: null, url, key: 'webhook-key' }), false);
  assert.equal(verifyWebhookSignature({ body, signature: goodSig, url, key: '' }), false);
  step('la firma del webhook solo vale para ese cuerpo, esa URL y esa clave');
  globalThis.fetch = realFetch;


  console.log('Etapa 10 — guías (etiquetas térmicas 4x6)');
  blocked(await createShipper({ name: '   ' }), 'nombre', 'remitente sin nombre');
  const sh = ok(await createShipper({ name: `e2e remitente ${stamp}`, idNumber: '0100000001', address: '1 test st', city: 'orlando', state: 'Florida', phone: '8630000001' }), 'crear remitente');
  created.shippers.push(sh.shipperId);
  assert.equal(sh.name, `E2E REMITENTE ${stamp}`);
  const sh2 = ok(await createShipper({ name: `e2e otro remitente ${stamp}` }), 'crear 2º remitente');
  created.shippers.push(sh2.shipperId);
  const co = ok(await createConsignee(sh.shipperId, { name: 'e2e destinataria', idNumber: '0107300030', country: 'ecuador', province: 'azuay', city: 'cuenca', declaredAddress: 'calle del batan', phone: '0974268718' }), 'crear destinatario');
  const co2 = ok(await createConsignee(sh2.shipperId, { name: 'e2e destinatario ajeno' }), 'destinatario del otro remitente');
  step('remitente y destinatario se guardan en mayúsculas; el nombre es obligatorio');

  const base = { shipperId: sh.shipperId, consigneeId: co.consigneeId, contents: 'zapatos prendas de vestir', itemCount: 1, weightLb: 8.25, declaredValue: 200, refPrefix: 'PKG', refNumber: 501 };
  const g1 = ok(await createGuide(base), 'crear guía 1');
  const g2 = ok(await createGuide({ ...base, retain: true, clientTracking: `evg${stamp}` }), 'crear guía 2');
  assert.match(g1.code, /^IFLWH\d{5}$/);
  const n1 = Number(g1.code.slice(5));
  assert.ok(n1 >= 100, 'la serie IFL no baja de IFLWH00100');
  assert.equal(g2.code, `IFLWH${String(n1 + 1).padStart(5, '0')}`);
  const guideRow2 = await prisma.guide.findUniqueOrThrow({ where: { id: g2.guideId } });
  assert.equal(guideRow2.status, 'RETAINED');
  assert.equal(guideRow2.contents, 'ZAPATOS PRENDAS DE VESTIR');
  step(`guías IFLWH consecutivas (${g1.code}, ${g2.code}); "retener en bodega" deja la guía RETENIDA`);

  // Identificador: toda guía lleva su PKG (o el de otro identificador) como tracking, sin cambiar la numeración IFLWH.
  assert.equal(g1.refCode, 'PKG501');
  assert.equal(g2.refCode, 'PKG501');
  blocked(await createGuide({ ...base, refNumber: undefined }), 'número del pkg', 'PKG sin número');
  blocked(await createGuide({ ...base, refPrefix: undefined, refNumber: undefined }), 'número del pkg', 'sin identificador = PKG, exige número');
  blocked(await createGuide({ ...base, refPrefix: 'ZZ' }), 'no existe', 'identificador inexistente');
  const jm = `J${String(stamp).replace(/\D/g, '').slice(-3).padStart(3, '0')}`;
  blocked(await createGuideIdentifier({ prefix: 'PKG' }), 'ya existe', 'PKG no se crea aparte');
  blocked(await createGuideIdentifier({ prefix: 'IFLX' }), 'confunde', 'prefijo que se confunde con IFLWH');
  blocked(await createGuideIdentifier({ prefix: '9X' }), 'letra', 'prefijo mal formado');
  const ident = ok(await createGuideIdentifier({ prefix: jm.toLowerCase(), description: 'e2e', startAt: 1 }), 'crear identificador');
  created.identifiers.push(ident.prefix);
  blocked(await createGuideIdentifier({ prefix: jm }), 'ya existe', 'identificador repetido');
  const j1 = ok(await createGuide({ ...base, refPrefix: jm, refNumber: undefined }), 'guía con identificador 1');
  const j2 = ok(await createGuide({ ...base, refPrefix: jm }), 'guía con identificador 2');
  assert.equal(j1.refCode, `${jm}001`);
  assert.equal(j2.refCode, `${jm}002`);
  assert.equal(j2.code, `IFLWH${String(Number(j1.code.slice(5)) + 1).padStart(5, '0')}`, 'la numeración IFLWH sigue igual con otro identificador');
  const otherPkg = ok(await createGuide({ ...base, refNumber: 777 }), 'guía de otro PKG');
  assert.equal(otherPkg.refCode, 'PKG777');
  assert.equal(otherPkg.code, `IFLWH${String(Number(j2.code.slice(5)) + 1).padStart(5, '0')}`);
  const jmRow = await prisma.guideIdentifier.findFirstOrThrow({ where: { prefix: jm } });
  ok(await setGuideIdentifierActive(jmRow.id, false), 'desactivar identificador');
  blocked(await createGuide({ ...base, refPrefix: jm }), 'desactivado', 'identificador desactivado');
  blocked(await deleteGuideIdentifier(jmRow.id), 'ya está en', 'identificador usado no se elimina');
  step(`identificadores: PKG501 / ${jm}001, ${jm}002; el consecutivo IFLWH no cambia; uno desactivado o usado no se elimina`);
  const spare = ok(await createGuideIdentifier({ prefix: `${jm}X`, startAt: 40 }), 'identificador con inicio 40');
  created.identifiers.push(spare.prefix);
  const sp = ok(await createGuide({ ...base, refPrefix: `${jm}X` }), 'primer paquete del identificador con inicio');
  assert.equal(sp.refCode, `${jm}X040`);
  step('un identificador puede continuar una secuencia que ya venías usando (empieza en 40)');

  blocked(await createGuide({ ...base, consigneeId: co2.consigneeId }), 'otro remitente', 'destinatario de otro remitente');
  blocked(await createGuide({ ...base, weightLb: 0 }), 'peso', 'peso en cero');
  blocked(await createGuide({ ...base, shipperId: undefined }), 'remitente', 'sin remitente');
  step('rechaza destinatario de otro remitente, peso en cero y guía sin remitente');
  const beforeRejected = await prisma.guide.count({ where: { shipperId: sh.shipperId } });
  blocked(await createGuide({ ...base, weightLb: 0 }), 'peso', 'peso en cero otra vez');
  assert.equal(await prisma.guide.count({ where: { shipperId: sh.shipperId } }), beforeRejected, 'un intento rechazado no crea guía');
  step('un intento rechazado no crea guía');

  ok(await updateGuide(g1.guideId, { ...base, weightLb: 9.5, refNumber: 502 }), 'editar guía');
  const edited = await prisma.guide.findUniqueOrThrow({ where: { id: g1.guideId } });
  assert.equal(edited.weightLb, 9.5);
  assert.equal(edited.refCode, 'PKG502');
  assert.equal(edited.code, g1.code, 'corregir el PKG no cambia el número IFLWH');
  ok(await updateGuide(j1.guideId, { ...base, refPrefix: 'PKG', refNumber: 9 }), 'editar guía con otro identificador');
  assert.equal((await prisma.guide.findUniqueOrThrow({ where: { id: j1.guideId } })).refCode, `${jm}001`, 'el número de otros identificadores no se edita');
  step('editar la guía actualiza peso y PKG (la numeración IFLWH queda igual); otros identificadores no se editan');

  ok(await setGuideStatus(g2.guideId, 'CREATED'), 'liberar guía');
  ok(await setGuideStatus(g2.guideId, 'IN_TRANSIT'), 'en tránsito');
  blocked(await setGuideStatus(g2.guideId, 'VOIDED'), 'no permitido', 'anular por cambio de estado');
  step('liberar y mover la guía de estado; anular solo por "Anular"');

  ok(await registerGuidePrints([g1.guideId, g1.guideId]), 'registrar impresión');
  assert.equal((await prisma.guide.findUniqueOrThrow({ where: { id: g1.guideId } })).printCount, 1);
  step('reimprimir lleva la cuenta de impresiones');

  const labels = await getLabelData([g1.guideId, 'no-existe']);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].code, g1.code);
  assert.equal(labels[0].destination, 'CUENCA, AZUAY, ECUADOR');
  assert.equal(labels[0].countryTag, 'EC');
  assert.equal(labels[0].refCode, 'PKG502');
  assert.ok(labels[0].toLines.includes('CALLE DEL BATAN'), 'la etiqueta usa la dirección guardada del destinatario');
  assert.ok(!labels[0].toLines.some((l) => l.startsWith('ENTREGAR EN')), 'sin dirección alterna');
  step('la etiqueta trae destino, país, tracking y la dirección del destinatario (sin otra alterna)');

  blocked(await deleteShipper(sh.shipperId), 'ya tiene', 'remitente con guías');
  blocked(await deleteConsignee(co.consigneeId), 'ya tiene', 'destinatario con guías');
  ok(await voidGuide(g2.guideId, 'error de digitación'), 'anular guía');
  blocked(await voidGuide(g2.guideId, ''), 'ya está anulada', 'anular dos veces');
  blocked(await updateGuide(g2.guideId, base), 'anulada', 'editar guía anulada');
  const g3 = ok(await createGuide(base), 'guía después de anular');
  assert.ok(Number(g3.code.slice(5)) > Number(sp.code.slice(5)), 'el número de una guía anulada no se reutiliza');
  step('con guías no se borra remitente ni destinatario; anular conserva el número (no se reutiliza)');
  ok(await deleteConsignee(co2.consigneeId), 'borrar destinatario sin guías');
  ok(await deleteShipper(sh2.shipperId), 'borrar remitente sin guías');
  created.shippers = created.shippers.filter((id) => id !== sh2.shipperId);
  step('un remitente sin guías sí se puede eliminar');

  // Guía de la caja: numeración IFLWH como todas, con el PKG de la caja como tracking; se crea con ella (o después).
  const pkgG = ok(await createPkg({ country: 'Ecuador', createGuide: true }), 'PKG con guía');
  created.pkgs.push(pkgG.pkgId);
  assert.ok(pkgG.guideId);
  const pkgRow = await prisma.pkg.findUniqueOrThrow({ where: { id: pkgG.pkgId } });
  const guideP = await prisma.guide.findUniqueOrThrow({ where: { id: pkgG.guideId! } });
  assert.equal(guideP.series, 'PKG');
  assert.match(guideP.code, /^IFLWH\d{5}$/);
  assert.equal(guideP.refCode, `PKG${pkgRow.number}`);
  assert.equal(guideP.refNumber, pkgRow.number);
  step(`al crear el PKG con la opción, la guía sale sola (${guideP.code}, tracking ${guideP.refCode})`);

  const maxPkg = await prisma.pkg.aggregate({ _max: { number: true } });
  const moved = (maxPkg._max.number ?? 0) + 7;
  ok(await updatePkgInfo(pkgG.pkgId, { number: moved }), 'renumerar PKG');
  const moved1 = await prisma.guide.findUniqueOrThrow({ where: { id: pkgG.guideId! } });
  assert.equal(moved1.refCode, `PKG${moved}`);
  assert.equal(moved1.code, guideP.code, 'renumerar el PKG no cambia el número IFLWH de su guía');
  step('si el PKG cambia de número, su guía conserva el IFLWH y lleva el nuevo PKG');

  const plain = ok(await createPkg({ country: 'Ecuador' }), 'PKG sin guía');
  created.pkgs.push(plain.pkgId);
  assert.equal(plain.guideId, null);
  assert.equal(await prisma.guide.count({ where: { pkgId: plain.pkgId } }), 0);
  const late = ok(await generatePkgGuide(plain.pkgId), 'generar guía después');
  const again = ok(await generatePkgGuide(plain.pkgId), 'generar guía otra vez');
  assert.equal(late.guideId, again.guideId);
  assert.equal(await prisma.guide.count({ where: { pkgId: plain.pkgId } }), 1);
  blocked(await setGuideStatus(late.guideId, 'IN_TRANSIT'), 'sigue el estado', 'estado manual en guía de PKG');
  blocked(await voidGuide(late.guideId, ''), 'junto con el pkg', 'anular guía de PKG');
  const pkgLabel = (await getLabelData([late.guideId]))[0];
  assert.equal(pkgLabel.series, 'PKG');
  assert.equal(pkgLabel.destination, 'ECUADOR');
  assert.match(pkgLabel.refCode ?? '', /^PKG\d+$/);
  assert.match(pkgLabel.code, /^IFLWH\d{5}$/);
  step('un PKG sin guía la genera después (una sola vez); la guía de caja sigue el estado del PKG');

  ok(await deletePkg(plain.pkgId), 'borrar PKG vacío');
  assert.equal(await prisma.guide.count({ where: { id: late.guideId } }), 0);
  created.pkgs = created.pkgs.filter((id) => id !== plain.pkgId);
  step('borrar un PKG vacío borra también su guía');

  console.log(`\n${passed} verificaciones de punta a punta superadas.`);
}

main()
  .then(async () => {
    await cleanup();
    await restoreConfig();
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('\n✗ FALLÓ:', err instanceof Error ? err.message : err);
    await cleanup().catch((e) => console.error('limpieza:', e));
    await restoreConfig().catch((e) => console.error('restaurar configuración:', e));
    await prisma.$disconnect();
    process.exit(1);
  });
