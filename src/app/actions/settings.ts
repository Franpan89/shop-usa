'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireStaff } from '@/lib/auth';
import { audit, getSettings, getTenantId } from '@/lib/tenant';

function num(formData: FormData, key: string, opts: { min?: number; max?: number; int?: boolean } = {}): number {
  const raw = (formData.get(key) as string | null)?.trim() ?? '';
  const value = opts.int ? parseInt(raw, 10) : parseFloat(raw);
  if (Number.isNaN(value)) throw new Error('Hay un valor numérico inválido');
  if (opts.min !== undefined && value < opts.min) throw new Error('Hay un valor por debajo del mínimo permitido');
  if (opts.max !== undefined && value > opts.max) throw new Error('Hay un valor por encima del máximo permitido');
  return value;
}

export const saveRates = safe(async function saveRates(formData: FormData) {
  const user = await requireAdmin();
  const tenantId = await getTenantId();
  await getSettings();
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: {
      taxRatePercent: num(formData, 'taxRatePercent', { min: 0, max: 100 }),
      personalShopperRatePercent: num(formData, 'personalShopperRatePercent', { min: 0, max: 100 }),
      cartServiceRatePercent: num(formData, 'cartServiceRatePercent', { min: 0, max: 100 }),
      referralDiscountPoints: num(formData, 'referralDiscountPoints', { min: 0, max: 100 }),
    },
  });
  await audit(prisma, { userName: user.name, action: 'settings.rates', entity: 'TenantSettings' });
  revalidatePath('/configuraciones');
});

export const saveRetention = safe(async function saveRetention(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  await getSettings();
  const warning = num(formData, 'retentionWarningDays', { min: 1, int: true });
  const max = num(formData, 'retentionMaxDays', { min: 1, int: true });
  if (warning > max) throw new Error('La advertencia debe ser antes del máximo de días');
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: {
      retentionWarningDays: warning,
      retentionMaxDays: max,
      clientAlertsEnabled: formData.get('clientAlertsEnabled') === 'on',
    },
  });
  revalidatePath('/configuraciones');
});

export const savePkgNumbering = safe(async function savePkgNumbering(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  await getSettings();
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { pkgStartNumber: num(formData, 'pkgStartNumber', { min: 1, int: true }) },
  });
  revalidatePath('/configuraciones');
});

export const saveCustody = safe(async function saveCustody(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  await getSettings();
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: {
      custodySmallFee: num(formData, 'custodySmallFee', { min: 0 }),
      custodyMediumFee: num(formData, 'custodyMediumFee', { min: 0 }),
      custodyLargeFee: num(formData, 'custodyLargeFee', { min: 0 }),
      deliveryBaseFee: num(formData, 'deliveryBaseFee', { min: 0 }),
      deliveryBaseMiles: num(formData, 'deliveryBaseMiles', { min: 0 }),
      deliveryExtraPerMile: num(formData, 'deliveryExtraPerMile', { min: 0 }),
    },
  });
  revalidatePath('/configuraciones');
});

export const savePaymentInstructions = safe(async function savePaymentInstructions(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  await getSettings();
  const text = ((formData.get('paymentInstructions') as string | null) ?? '').trim();
  await prisma.tenantSettings.update({ where: { tenantId }, data: { paymentInstructions: text || null } });
  revalidatePath('/configuraciones');
  revalidatePath('/portal');
});

/** Fecha y hora límite semanal para que el cliente solicite retener su mercancía (3.11). */
export const saveCutoff = safe(async function saveCutoff(formData: FormData) {
  await requireStaff();
  const tenantId = await getTenantId();
  await getSettings();
  const raw = ((formData.get('dispatchCutoffAt') as string | null) ?? '').trim();
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { dispatchCutoffAt: raw ? new Date(raw) : null },
  });
  revalidatePath('/consolidados');
  revalidatePath('/configuraciones');
  revalidatePath('/portal');
});

// ── Países y reglas de despacho (7.13) ──────────────────────────────────────

export const saveCountryRule = safe(async function saveCountryRule(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  const id = (formData.get('id') as string | null) || null;
  const name = ((formData.get('name') as string | null) ?? '').trim();
  const codePrefix = ((formData.get('codePrefix') as string | null) ?? '').trim().toUpperCase();
  if (!name || !/^[A-Z]{2,4}$/.test(codePrefix)) throw new Error('Indica el país y un prefijo de 2 a 4 letras (EC, PTY…)');

  const data = {
    name,
    codePrefix,
    active: formData.get('active') === 'on',
    allowDispatchWithBalance: formData.get('allowDispatchWithBalance') === 'on',
    requireFullPaymentBeforeDelivery: formData.get('requireFullPaymentBeforeDelivery') === 'on',
    usesDeconsolidation: formData.get('usesDeconsolidation') === 'on',
  };

  if (id) {
    await prisma.countryRule.update({ where: { id }, data });
  } else {
    await prisma.countryRule.create({ data: { ...data, active: true, tenantId } });
  }
  revalidatePath('/configuraciones');
});

export const deleteCountryRule = safe(async function deleteCountryRule(id: string) {
  await requireAdmin();
  const rule = await prisma.countryRule.findUnique({ where: { id } });
  if (!rule) return;
  const clients = await prisma.client.count({ where: { country: rule.name } });
  if (clients > 0) throw new Error(`Hay ${clients} cliente(s) en ${rule.name}; desactívalo en lugar de eliminarlo.`);
  await prisma.countryRule.delete({ where: { id } });
  revalidatePath('/configuraciones');
});

/** Ajusta el próximo consecutivo de clientes (p. ej. para continuar la numeración anterior). */
export const setNextClientNumber = safe(async function setNextClientNumber(formData: FormData) {
  await requireAdmin();
  const tenantId = await getTenantId();
  const next = num(formData, 'nextClientNumber', { min: 1, int: true });
  await prisma.counter.upsert({
    where: { tenantId_key: { tenantId, key: 'client' } },
    create: { tenantId, key: 'client', value: next - 1 },
    update: { value: next - 1 },
  });
  revalidatePath('/configuraciones');
});
