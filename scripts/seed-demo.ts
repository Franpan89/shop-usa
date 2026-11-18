/**
 * Datos ficticios para la instancia DEMO: 15 clientes en distintas etapas del flujo, con pedidos, pagos,
 * consolidados, cajas, despachos, custodio, referidos y gastos. Usa las Server Actions reales (con sesión
 * y correo simulados), así facturas, saldos y estados quedan consistentes.
 *
 *   npm run seed:demo      (lee .env.demo; borra TODOS los datos de negocio de esa base y los vuelve a crear)
 *
 * Se puede correr cuantas veces haga falta: es el "restablecer demo".
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import prisma from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUploadTarget } from '@/lib/storage';
import { DEMO_ACCOUNTS } from '@/lib/demo';
import { createClient } from '@/app/actions/clients';
import { createOrder, cancelOrder } from '@/app/actions/orders';
import { registerPayment } from '@/app/actions/payments';
import { markProductsPurchased, receiveProducts, createCasilleroItems, registerCustodyPackage } from '@/app/actions/purchasing';
import { closeConsolidation, setConsolidationDecision, setConsolidationWeight } from '@/app/actions/consolidations';
import { addPkgsToDispatch, assignProductsToPkg, closePkg, confirmDispatch, confirmProductsArrived, createDispatch, createPkg, markProductsDelivered, receivePkgsAtDestination } from '@/app/actions/logistics';
import { setCustodyActive } from '@/app/actions/custody';
import { portalSubmitTransfer } from '@/app/actions/portal';
import { requestPortalAccess } from '@/app/actions/access';
import { createExpense } from '@/app/actions/expenses';

process.env.SEED_STAFF_NAME = DEMO_ACCOUNTS.admin.name;

// ── Seguridad: este script BORRA datos. Solo corre contra una base marcada como demo y distinta a la de desarrollo.
function guard() {
  if (process.env.DEMO_MODE !== 'true') throw new Error('DEMO_MODE no es "true": el seed del demo solo corre con .env.demo');
  if (!process.env.DEMO_PASSWORD) throw new Error('Falta DEMO_PASSWORD en .env.demo');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.demo');
  if (existsSync('.env')) {
    const dev = readFileSync('.env', 'utf8');
    for (const key of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
      const m = dev.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, 'm'));
      if (m && m[1] === process.env[key]) throw new Error(`${key} es igual al de .env (desarrollo/producción). Abortado: el demo usa su propia base.`);
    }
  }
}

type Res = { ok: true } | { ok: false; error: string };
function ok<T extends Res>(res: T, label: string): Extract<T, { ok: true }> {
  if (!res.ok) throw new Error(`${label}: ${(res as { error: string }).error}`);
  return res as Extract<T, { ok: true }>;
}
const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};
const log = (s: string) => console.log(`  · ${s}`);
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const isoDay = (n: number) => daysAgo(n).toISOString().slice(0, 10);

// ── Fotos de producto: mosaico SVG (no depende de internet ni de archivos).
const tile = (emoji: string, color: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="${color}"/><text x="80" y="104" font-size="72" text-anchor="middle">${emoji}</text></svg>`);

interface Item { name: string; quantity: number; unitPrice: number; storeName: string; imageUrl: string }
const item = (name: string, quantity: number, unitPrice: number, storeName: string, emoji: string, color: string): Item => ({ name, quantity, unitPrice, storeName, imageUrl: tile(emoji, color) });

// ── Comprobante ficticio (PNG generado a mano: sin dependencias) para que la verificación de pagos se vea real.
function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function receiptPng(accent: [number, number, number]) {
  const w = 320;
  const h = 440;
  const raw = Buffer.alloc((w * 3 + 1) * h, 255);
  const paint = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2];
    }
  };
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0; // filtro "none" por fila
  paint(0, 0, w, 70, accent); // encabezado
  paint(24, 24, 150, 44, [255, 255, 255]);
  paint(24, 100, 170, 112, [90, 90, 90]); // "Transferencia exitosa"
  const rows: [number, number][] = [[140, 120], [172, 200], [204, 150], [236, 220], [268, 120], [300, 180]];
  for (const [y, len] of rows) {
    paint(24, y, 24 + 80, y + 9, [170, 170, 170]);
    paint(w - 24 - len * 0.7, y, w - 24, y + 9, [60, 60, 60]);
  }
  paint(24, 340, w - 24, 342, [210, 210, 210]);
  paint(24, 364, 24 + 110, 392, accent);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
async function uploadPng(kind: 'proof' | 'receipt', accent: [number, number, number]) {
  const target = await createUploadTarget(kind, 'png');
  const { error } = await createAdminClient().storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, receiptPng(accent), { contentType: 'image/png' });
  if (error) throw new Error(`No se pudo subir la imagen de ejemplo: ${error.message}`);
  return target.path;
}

// ── Fechas: las acciones usan "ahora"; luego se mueve cada historia al pasado para que el panel se vea vivo.
async function shiftSince(clientId: string, days: number, sinceRaw: Date) {
  if (days <= 0) return;
  const since = new Date(sinceRaw.getTime() - 120_000); // margen por diferencia de reloj con la base remota
  const q = (table: string, cols: string[]) =>
    prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET ${cols.map((c) => `"${c}" = "${c}" - ${days} * interval '1 day'`).join(', ')} WHERE "clientId" = $1 AND "createdAt" >= $2`,
      clientId, since,
    );
  await q('Order', ['orderDate', 'createdAt', 'cancelledAt', 'courtesyAuthorizedAt']);
  await q('Product', ['purchasedAt', 'receivedAt', 'destinationReceivedAt', 'deliveredAt', 'createdAt']);
  await q('Invoice', ['issueDate', 'cancelledAt', 'createdAt']);
  await q('Payment', ['paidAt', 'verifiedAt', 'createdAt']);
  await q('Consolidation', ['decidedAt', 'retentionStartedAt', 'weightUpdatedAt', 'closedAt', 'createdAt']);
  await q('CustodyPackage', ['receivedAt', 'deliveredAt', 'createdAt']);
}
async function shiftClientRow(clientId: string, days: number) {
  await prisma.$executeRawUnsafe(`UPDATE "Client" SET "createdAt" = "createdAt" - ${days} * interval '1 day' WHERE id = $1`, clientId);
}
async function shiftLogistics(pkgIds: string[], dispatchId: string | null, days: number) {
  for (const id of pkgIds) await prisma.$executeRawUnsafe(`UPDATE "Pkg" SET "createdAt" = "createdAt" - ${days} * interval '1 day', "closedAt" = "closedAt" - ${days} * interval '1 day' WHERE id = $1`, id);
  if (dispatchId) await prisma.$executeRawUnsafe(`UPDATE "Dispatch" SET "date" = "date" - ${days} * interval '1 day', "confirmedAt" = "confirmedAt" - ${days} * interval '1 day', "createdAt" = "createdAt" - ${days} * interval '1 day' WHERE id = $1`, dispatchId);
}

// ── Atajos de flujo
type Cl = { id: string; code: string; name: string };
const clients: Record<string, Cl> = {};

async function productIds(where: { orderId?: string; clientId?: string; status?: string; pkgId?: null }) {
  const rows = await prisma.product.findMany({ where: where as never, select: { id: true } });
  return rows.map((r) => r.id);
}
async function placeOrder(c: Cl, type: 'PERSONAL_SHOPPER' | 'CART', items: Item[], extra: { channel?: string; discount?: { type: 'AMOUNT' | 'PERCENT'; value: number; reason?: string } } = {}) {
  const res = ok(await createOrder({ clientId: c.id, type, items, channel: extra.channel ?? 'WhatsApp', discount: extra.discount }), `pedido de ${c.name}`);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { invoice: true } });
  return { id: res.orderId, total: order.totalAmount, invoiceId: order.invoice!.id };
}
const payOrder = async (c: Cl, o: { total: number; invoiceId: string }, method: 'TRANSFER' | 'CARD' | 'CASH' | 'ONLINE' = 'TRANSFER', reference?: string) =>
  ok(await registerPayment({ clientId: c.id, amount: o.total, method, targetInvoiceId: o.invoiceId, reference }), `pago de ${c.name}`);
const buyAndReceive = async (c: Cl, orderId: string) => {
  const ids = await productIds({ orderId });
  ok(await markProductsPurchased(ids), `compra de ${c.name}`);
  ok(await receiveProducts(ids), `recepción de ${c.name}`);
  return ids;
};
const openConsolidation = (c: Cl) => prisma.consolidation.findFirstOrThrow({ where: { clientId: c.id, status: 'OPEN' } });
async function weighAndClose(c: Cl, weight: number) {
  const cons = await openConsolidation(c);
  ok(await setConsolidationWeight(cons.id, weight), `peso de ${c.name}`);
  ok(await closeConsolidation(cons.id), `cierre de ${c.name}`);
  return prisma.consolidation.findUniqueOrThrow({ where: { id: cons.id }, include: { invoice: true } });
}
async function receiveFromCasillero(c: Cl, items: Item[]) {
  ok(await createCasilleroItems(c.id, items.map((i) => ({ name: i.name, quantity: i.quantity, imageUrl: i.imageUrl }))), `casillero de ${c.name}`);
}
/** PKG → despacho confirmado (EN TRÁNSITO). Devuelve los ids para seguir el flujo. */
async function sendBox(country: string, productIdsInBox: string[], tracking: string, carrier: string, dispatchDaysAgo: number, number: number) {
  const pkg = ok(await createPkg({ country, number }), 'PKG');
  ok(await assignProductsToPkg(pkg.pkgId, productIdsInBox), 'asignar al PKG');
  ok(await closePkg(pkg.pkgId), 'cerrar PKG');
  await prisma.pkg.update({ where: { id: pkg.pkgId }, data: { trackingNumber: tracking, carrier } });
  const dsp = ok(await createDispatch({ country, date: isoDay(dispatchDaysAgo), notes: 'Vuelo de carga semanal' }), 'despacho');
  ok(await addPkgsToDispatch(dsp.dispatchId, [pkg.pkgId]), 'PKG al despacho');
  ok(await confirmDispatch(dsp.dispatchId), 'confirmar despacho');
  return { pkgId: pkg.pkgId, dispatchId: dsp.dispatchId };
}
async function arrive(pkgId: string, ids: string[]) {
  ok(await receivePkgsAtDestination([pkgId]), 'PKG recibido en destino');
  ok(await confirmProductsArrived(ids), 'productos confirmados');
}

// ── Limpieza y cuentas de acceso
async function wipe() {
  console.log('Limpiando datos de negocio…');
  await prisma.cardCheckout.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.referralBenefit.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.custodyPackage.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.consolidation.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.guide.deleteMany({});
  await prisma.consignee.deleteMany({});
  await prisma.shipper.deleteMany({});
  await prisma.pkg.deleteMany({});
  await prisma.dispatch.deleteMany({});
  await prisma.accessRequest.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.productCatalog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.counter.deleteMany({});
  await prisma.client.updateMany({ data: { referredById: null } });
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({});
}

async function ensureAuthUser(email: string) {
  const admin = createAdminClient();
  const password = process.env.DEMO_PASSWORD!;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error) return;
  if (!/already|registered|exists/i.test(created.error.message)) throw new Error(`Supabase Auth (${email}): ${created.error.message}`);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`No se encontró la cuenta ${email}`);
  const upd = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (upd.error) throw new Error(`Supabase Auth (${email}): ${upd.error.message}`);
}

async function main() {
  guard();
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No hay tenant: corre primero la siembra base (npm run seed:demo la incluye).');
  await wipe();

  console.log('Cuentas de acceso…');
  for (const key of ['admin', 'staff', 'client'] as const) await ensureAuthUser(DEMO_ACCOUNTS[key].email);
  await prisma.user.create({ data: { tenantId: tenant.id, name: DEMO_ACCOUNTS.admin.name, email: DEMO_ACCOUNTS.admin.email, role: 'ADMIN' } });
  await prisma.user.create({ data: { tenantId: tenant.id, name: DEMO_ACCOUNTS.staff.name, email: DEMO_ACCOUNTS.staff.email, role: 'SUBADMIN' } });

  await prisma.tenant.update({ where: { id: tenant.id }, data: { name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Courier Demo' } });
  await prisma.tenantSettings.update({
    where: { tenantId: tenant.id },
    data: {
      dispatchCutoffAt: new Date(Date.now() + 4 * DAY),
      paymentInstructions: 'Transferencia a Banco Ejemplo · Cuenta corriente 000123456789 · Titular: Courier Demo LLC · Envía el comprobante desde tu portal.',
    },
  });

  const general = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Ecuador General' } });
  const familiar = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Ecuador Familiar / Migrante' } });
  const emprendedor = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Ecuador Emprendedores' } });
  const panama = await prisma.shippingCategory.findFirstOrThrow({ where: { name: 'Panamá' } });

  console.log('Clientes…');
  const spec = [
    { key: 'maria', name: 'María Fernanda Salazar', country: 'Ecuador', city: 'Quito', cat: general, fee: 20, phone: '+593 99 812 3401', email: DEMO_ACCOUNTS.client.email, b: [3, 18], home: true },
    { key: 'diego', name: 'Diego Paredes', country: 'Ecuador', city: 'Guayaquil', cat: general, fee: 20, phone: '+593 98 455 2210', email: 'diego.paredes@demo-courier.com', b: [7, 2] },
    { key: 'lucia', name: 'Lucía Montalvo', country: 'Ecuador', city: 'Cuenca', cat: emprendedor, fee: 15, phone: '+593 99 301 7788', email: 'lucia.montalvo@demo-courier.com', b: [11, 25] },
    { key: 'andres', name: 'Andrés Cevallos', country: 'Ecuador', city: 'Quito', cat: general, fee: 20, phone: '+593 98 120 9934', b: [1, 9] },
    { key: 'paola', name: 'Paola Villacís', country: 'Ecuador', city: 'Ambato', cat: familiar, fee: 20, phone: '+593 99 678 4412', email: 'paola.villacis@demo-courier.com', b: [5, 30] },
    { key: 'jorge', name: 'Jorge Albán', country: 'Ecuador', city: 'Loja', cat: general, fee: 10, phone: '+593 98 733 0156', b: [9, 14] },
    { key: 'gabriela', name: 'Gabriela Naranjo', country: 'Ecuador', city: 'Quito', cat: familiar, fee: 20, phone: '+593 99 245 6671', b: [2, 21] },
    { key: 'sebastian', name: 'Sebastián Torres', country: 'Ecuador', city: 'Guayaquil', cat: general, fee: 20, phone: '+593 98 900 1127', email: 'sebastian.torres@demo-courier.com', b: [12, 4] },
    { key: 'veronica', name: 'Verónica Játiva', country: 'Ecuador', city: 'Riobamba', cat: general, fee: 20, phone: '+593 99 540 8832', b: [6, 11], home: true },
    { key: 'mateo', name: 'Mateo Cárdenas', country: 'Ecuador', city: 'Manta', cat: general, fee: 20, phone: '+593 98 316 7745', b: [8, 27] },
    { key: 'analucia', name: 'Ana Lucía Barría', country: 'Panamá', city: 'Ciudad de Panamá', cat: panama, fee: 20, phone: '+507 6612 4401', email: 'ana.barria@demo-courier.com', b: [4, 16] },
    { key: 'ricardo', name: 'Ricardo Quintero', country: 'Panamá', city: 'David', cat: panama, fee: 20, phone: '+507 6784 2209', b: [10, 8] },
    { key: 'karina', name: 'Karina Samaniego', country: 'Panamá', city: 'Ciudad de Panamá', cat: panama, fee: 20, phone: '+507 6290 7713', b: [9, 22], referredBy: 'analucia' },
    { key: 'luis', name: 'Luis Chiari', country: 'Panamá', city: 'Colón', cat: panama, fee: 15, phone: '+507 6455 3098', b: [1, 28] },
    { key: 'natalia', name: 'Natalia Arosemena', country: 'Panamá', city: 'Ciudad de Panamá', cat: panama, fee: 20, phone: '+507 6033 9120', b: [12, 15] },
  ];
  for (const s of spec) {
    const res = ok(await createClient(form({
      name: s.name, country: s.country, city: s.city, phone: s.phone, serviceFeePercent: String(s.fee),
      shippingCategoryId: s.cat.id, birthdayMonth: String(s.b[0]), birthdayDay: String(s.b[1]),
      ...(s.email ? { email: s.email } : {}),
      ...(s.home ? { deliveryMethod: 'HOME_DELIVERY', deliveryAddress: `Av. Principal y Calle ${s.b[1]}, ${s.city}` } : {}),
      ...('referredBy' in s && s.referredBy ? { referredById: clients[s.referredBy].id } : {}),
    })), `cliente ${s.name}`);
    clients[s.key] = { id: res.clientId, code: res.code, name: s.name };
    log(`${res.code} ${s.name}`);
  }

  // ── 1. María (portal de demostración): ciclo completo entregado + productos hoy en bodega + un pedido por pagar
  console.log('Historias…');
  {
    const c = clients.maria;
    const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Zapatillas Nike Air Max 90', 1, 129.99, 'Nike', '👟', '#e8f0fe'),
      item('Perfume Carolina Herrera Good Girl 80 ml', 1, 118, 'Macy\'s', '🧴', '#fde8f0'),
      item('Cartera Michael Kors Jet Set', 1, 198, 'Michael Kors', '👜', '#fef3e0'),
    ]);
    await payOrder(c, o, 'TRANSFER', 'TR-48821');
    const ids = await buyAndReceive(c, o.id);
    const cons = await weighAndClose(c, 4.6);
    const box = await sendBox('Ecuador', ids, 'EC4417880021', 'Servientrega', 1, 500);
    await arrive(box.pkgId, ids);
    ok(await registerPayment({ clientId: c.id, amount: cons.invoice!.total, method: 'TRANSFER', targetInvoiceId: cons.invoice!.id, reference: 'TR-49310' }), 'pago de envío de María');
    ok(await markProductsDelivered(ids), 'entrega a María');
    await shiftSince(c.id, 45, t0);
    await shiftLogistics([box.pkgId], box.dispatchId, 45);
    await shiftClientRow(c.id, 50);

    const t1 = new Date();
    const o2 = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Set de maquillaje Fenty Beauty', 1, 76, 'Sephora', '💄', '#fde8f0'),
      item('Vitaminas Centrum Adultos x200', 2, 24.5, 'Walmart', '💊', '#e6f6ec'),
    ]);
    await payOrder(c, o2, 'TRANSFER', 'TR-50127');
    await buyAndReceive(c, o2.id);
    await receiveFromCasillero(c, [item('Audífonos Sony WH-1000XM5', 1, 0, 'Amazon', '🎧', '#e8f0fe')]);
    const cons2 = await openConsolidation(c);
    ok(await setConsolidationWeight(cons2.id, 3.1), 'peso 2 de María');
    await shiftSince(c.id, 6, t1);

    const t2 = new Date();
    await placeOrder(c, 'PERSONAL_SHOPPER', [item('Chaqueta North Face Resolve', 1, 89.99, 'The North Face', '🧥', '#e6f6ec')]);
    await shiftSince(c.id, 1, t2);
  }

  // ── 2. Diego: pedido nuevo pendiente de pago
  {
    const c = clients.diego; const t0 = new Date();
    await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Consola Nintendo Switch OLED', 1, 349.99, 'Best Buy', '🎮', '#fde8e8'),
      item('Funda protectora + 2 juegos', 1, 64, 'Amazon', '🕹️', '#e8f0fe'),
    ], { channel: 'Web' });
    await shiftSince(c.id, 2, t0); await shiftClientRow(c.id, 20);
  }

  // ── 3. Lucía (Emprendedores): casillero retenido casi al límite (alerta de retención)
  {
    const c = clients.lucia; const t0 = new Date();
    await receiveFromCasillero(c, [
      item('Bolsas de envío de papel kraft (caja x100)', 4, 0, 'Uline', '📦', '#fef3e0'),
      item('Camisetas básicas surtidas (lote)', 6, 0, 'Walmart', '👕', '#e8f0fe'),
      item('Estuches de celular (lote)', 3, 0, 'Amazon', '📱', '#e6f6ec'),
    ]);
    const cons = await openConsolidation(c);
    ok(await setConsolidationWeight(cons.id, 18.4), 'peso de Lucía');
    ok(await setConsolidationDecision(cons.id, 'HOLD'), 'retener a Lucía');
    await shiftSince(c.id, 24, t0); await shiftClientRow(c.id, 60);
  }

  // ── 4. Andrés: pagó, listo para comprar
  {
    const c = clients.andres; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('iPad 10.ª generación 64 GB', 1, 349, 'Apple', '📱', '#e8f0fe'),
      item('Apple Pencil (USB-C)', 1, 79, 'Apple', '✏️', '#fef3e0'),
    ]);
    await payOrder(c, o, 'TRANSFER', 'TR-50233');
    await shiftSince(c.id, 3, t0); await shiftClientRow(c.id, 14);
  }

  // ── 5. Paola: comprobante enviado desde el portal, esperando verificación
  {
    const c = clients.paola; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Mochila escolar Jansport (x2)', 2, 42, 'Target', '🎒', '#fde8e8'),
      item('Uniformes deportivos Adidas', 3, 28.5, 'Adidas', '👕', '#e8f0fe'),
    ]);
    const proof = await uploadPng('proof', [31, 94, 168]);
    (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = { kind: 'portal', id: c.id, name: c.name, email: 'paola.villacis@demo-courier.com' };
    ok(await portalSubmitTransfer({ amount: o.total, proofPath: proof, targetInvoiceId: o.invoiceId, reference: 'TR-50291' }), 'comprobante de Paola');
    (globalThis as unknown as { __e2ePortal?: unknown }).__e2ePortal = undefined;
    await shiftSince(c.id, 1, t0); await shiftClientRow(c.id, 9);
  }

  // ── 6. Jorge: comprado, esperando llegada a bodega
  {
    const c = clients.jorge; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Taladro inalámbrico DeWalt 20V', 1, 129, 'Home Depot', '🔧', '#fef3e0'),
      item('Juego de brocas 100 piezas', 1, 34.5, 'Home Depot', '🔩', '#e6f6ec'),
    ]);
    await payOrder(c, o, 'CASH');
    ok(await markProductsPurchased(await productIds({ orderId: o.id })), 'compra de Jorge');
    await shiftSince(c.id, 6, t0); await shiftClientRow(c.id, 30);
  }

  // ── 7. Gabriela: consolidado cerrado y facturado, esperando caja
  {
    const c = clients.gabriela; const t0 = new Date();
    await receiveFromCasillero(c, [
      item('Ropa de bebé (lote)', 8, 0, 'Carter\'s', '🍼', '#fde8f0'),
      item('Fórmula infantil Enfamil x3', 3, 0, 'Walmart', '🍼', '#e8f0fe'),
      item('Juguetes didácticos Fisher-Price', 2, 0, 'Target', '🧸', '#fef3e0'),
    ]);
    await weighAndClose(c, 9.3);
    await shiftSince(c.id, 12, t0); await shiftClientRow(c.id, 40);
  }

  // ── 8. Sebastián: en tránsito con saldo pendiente (Ecuador despacha con saldo)
  {
    const c = clients.sebastian; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Smartwatch Garmin Forerunner 265', 1, 449.99, 'Garmin', '⌚', '#e8f0fe'),
      item('Correas de repuesto x3', 1, 29, 'Amazon', '⌚', '#fef3e0'),
    ]);
    await payOrder(c, o, 'CARD', 'POS-77120');
    const ids = await buyAndReceive(c, o.id);
    await weighAndClose(c, 2.3);
    const box = await sendBox('Ecuador', ids, 'EC4417883302', 'Servientrega', 3, 503);
    await shiftSince(c.id, 8, t0); await shiftLogistics([box.pkgId], box.dispatchId, 3); await shiftClientRow(c.id, 35);
  }

  // ── 9. Verónica: ya llegó pero debe el envío → NO ENTREGAR
  {
    const c = clients.veronica; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Aspiradora robot Roomba i3', 1, 279.99, 'Amazon', '🤖', '#e6f6ec'),
      item('Freidora de aire Ninja 5.5 qt', 1, 99.95, 'Target', '🍳', '#fde8e8'),
    ]);
    await payOrder(c, o, 'TRANSFER', 'TR-49955');
    const ids = await buyAndReceive(c, o.id);
    await weighAndClose(c, 13.6);
    const box = await sendBox('Ecuador', ids, 'EC4417879914', 'Servientrega', 11, 502);
    await arrive(box.pkgId, ids);
    await shiftSince(c.id, 18, t0); await shiftLogistics([box.pkgId], box.dispatchId, 11); await shiftClientRow(c.id, 70);
  }

  // ── 10. Mateo: "Compramos tu carrito" + custodio de paquetería activo
  {
    const c = clients.mateo; const t0 = new Date();
    const o = await placeOrder(c, 'CART', [item('Carrito Amazon (11 artículos)', 1, 212.4, 'Amazon', '🛒', '#fef3e0')], { channel: 'Instagram' });
    await payOrder(c, o, 'TRANSFER', 'TR-50011');
    ok(await markProductsPurchased(await productIds({ orderId: o.id })), 'carrito de Mateo');
    ok(await setCustodyActive(c.id, true, isoDay(-25)), 'custodio de Mateo');
    ok(await registerCustodyPackage({ clientId: c.id, size: 'MEDIUM', storeNote: 'Amazon' }), 'custodio 1');
    ok(await registerCustodyPackage({ clientId: c.id, size: 'SMALL', storeNote: 'Shein' }), 'custodio 2');
    await shiftSince(c.id, 5, t0); await shiftClientRow(c.id, 26);
  }

  // ── 11. Ana Lucía (Panamá): ciclo completo, todo pagado y entregado; luego un pedido con su beneficio de referido
  {
    const c = clients.analucia; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Cafetera Nespresso Vertuo Next', 1, 159, 'Nespresso', '☕', '#fef3e0'),
      item('Cápsulas Nespresso x50', 1, 62, 'Nespresso', '☕', '#e6f6ec'),
    ]);
    await payOrder(c, o, 'TRANSFER', 'TR-48100');
    const ids = await buyAndReceive(c, o.id);
    const cons = await weighAndClose(c, 5.2);
    ok(await registerPayment({ clientId: c.id, amount: cons.invoice!.total, method: 'TRANSFER', targetInvoiceId: cons.invoice!.id, reference: 'TR-48411' }), 'envío de Ana Lucía');
    const box = await sendBox('Panamá', ids, 'PA8800124471', 'Copa Cargo', 1, 501);
    await arrive(box.pkgId, ids);
    ok(await markProductsDelivered(ids), 'entrega a Ana Lucía');
    await shiftSince(c.id, 38, t0); await shiftLogistics([box.pkgId], box.dispatchId, 38); await shiftClientRow(c.id, 75);
  }

  // ── 12. Ricardo (Panamá): consolidado cerrado con envío sin pagar → no autorizado para despacho
  {
    const c = clients.ricardo; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Laptop HP Pavilion 15"', 1, 549, 'Best Buy', '💻', '#e8f0fe'),
      item('Mouse y teclado inalámbricos', 1, 49.9, 'Amazon', '⌨️', '#fef3e0'),
    ]);
    await payOrder(c, o, 'TRANSFER', 'TR-49402');
    await buyAndReceive(c, o.id);
    await weighAndClose(c, 6.8);
    await shiftSince(c.id, 15, t0); await shiftClientRow(c.id, 45);
  }

  // ── 13. Karina (referida de Ana Lucía): su primer pedido pagado genera el beneficio; ya está en una caja en preparación
  {
    const c = clients.karina; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [
      item('Vestido de fiesta Zara (x2)', 2, 49.9, 'Zara', '👗', '#fde8f0'),
      item('Sandalias Steve Madden', 1, 79, 'Nordstrom', '👡', '#fef3e0'),
    ]);
    await payOrder(c, o, 'ONLINE', 'WEB-3301');
    const ids = await buyAndReceive(c, o.id);
    const cons = await weighAndClose(c, 3.4);
    ok(await registerPayment({ clientId: c.id, amount: cons.invoice!.total, method: 'TRANSFER', targetInvoiceId: cons.invoice!.id, reference: 'TR-50188' }), 'envío de Karina');
    const pkg = ok(await createPkg({ country: 'Panamá', number: 504 }), 'PKG Panamá en preparación');
    ok(await assignProductsToPkg(pkg.pkgId, ids), 'asignar Karina');
    await shiftSince(c.id, 9, t0); await shiftClientRow(c.id, 12);
    await prisma.pkg.update({ where: { id: pkg.pkgId }, data: { createdAt: daysAgo(2) } });

    // Ana Lucía compra de nuevo: se le aplica el beneficio (tasa 20 % → 15 % en esta factura)
    const a = clients.analucia; const t1 = new Date();
    await placeOrder(a, 'PERSONAL_SHOPPER', [item('Bocina JBL Charge 5', 1, 179.95, 'Best Buy', '🔊', '#e8f0fe')]);
    await shiftSince(a.id, 1, t1);
  }

  // ── 14. Luis: pedido cancelado
  {
    const c = clients.luis; const t0 = new Date();
    const o = await placeOrder(c, 'PERSONAL_SHOPPER', [item('Bicicleta eléctrica plegable', 1, 799, 'Amazon', '🚲', '#e6f6ec')]);
    ok(await cancelOrder(o.id, 'El cliente desistió de la compra'), 'cancelar pedido de Luis');
    await shiftSince(c.id, 22, t0); await shiftClientRow(c.id, 25);
  }

  // ── 15. Natalia: cuenta sin datos + solicitud de acceso al portal pendiente
  {
    const c = clients.natalia;
    ok(await requestPortalAccess(form({ code: c.code, email: 'natalia.arosemena@demo-courier.com', phone: '+507 6033 9120' })), 'solicitud de Natalia');
    await shiftClientRow(c.id, 1);
  }

  // ── Gastos del negocio (con fotos de recibo, algunas con varias)
  console.log('Gastos…');
  const r1 = await uploadPng('receipt', [60, 60, 60]);
  const r2 = await uploadPng('receipt', [60, 60, 60]);
  const r3 = await uploadPng('receipt', [120, 60, 30]);
  const expenses = [
    { d: 40, category: 'LOGISTICS', description: 'Flete aéreo Miami → Quito (PKG anterior)', country: 'Ecuador', amount: 286.4, receipts: [r1, r2] },
    { d: 33, category: 'SUPPLIES', description: 'Cajas y cinta de embalaje', country: 'Estados Unidos', amount: 64.18, receipts: [r3] },
    { d: 28, category: 'LOGISTICS', description: 'Flete aéreo Miami → Ciudad de Panamá', country: 'Panamá', amount: 154.9, receipts: [] },
    { d: 21, category: 'SALES', description: 'Publicidad en Instagram (campaña de casillero)', country: 'Ecuador', amount: 120, receipts: [] },
    { d: 14, category: 'SUPPLIES', description: 'Bolsas, etiquetas y papel burbuja', country: 'Estados Unidos', amount: 47.35, receipts: [r1] },
    { d: 9, category: 'OTHER', description: 'Suscripción de software (CRM y correo)', country: 'Estados Unidos', amount: 39, receipts: [] },
    { d: 4, category: 'LOGISTICS', description: 'Flete aéreo Miami → Guayaquil', country: 'Ecuador', amount: 312.75, receipts: [r2, r3] },
    { d: 2, category: 'OTHER', description: 'Transporte local a tiendas', country: 'Estados Unidos', amount: 18.6, receipts: [] },
  ];
  for (const e of expenses) {
    ok(await createExpense({ expenseDate: isoDay(e.d), category: e.category, description: e.description, country: e.country, originalAmount: e.amount, receiptPaths: e.receipts }), `gasto: ${e.description}`);
  }

  // Los despachos se numeraron en el orden en que se sembraron; se reordenan por fecha para que el historial tenga sentido.
  const dispatches = await prisma.dispatch.findMany({ orderBy: { date: 'asc' } });
  for (const [i, d] of dispatches.entries()) await prisma.dispatch.update({ where: { id: d.id }, data: { number: 1000 + i + 1 } });
  for (const [i, d] of dispatches.entries()) await prisma.dispatch.update({ where: { id: d.id }, data: { number: i + 1 } });

  // Numeración lista para que el equipo siga creando clientes sin chocar con los del demo.
  const summary = await Promise.all([
    prisma.client.count(), prisma.order.count(), prisma.invoice.count(), prisma.payment.count(), prisma.pkg.count(), prisma.dispatch.count(), prisma.expense.count(),
  ]);
  console.log(`\nDemo listo: ${summary[0]} clientes, ${summary[1]} pedidos, ${summary[2]} facturas, ${summary[3]} pagos, ${summary[4]} PKG, ${summary[5]} despachos, ${summary[6]} gastos.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('\n✗ FALLÓ:', err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
