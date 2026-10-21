'use server';

import { safe } from '@/lib/action';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { assertEmailFree } from '@/lib/clientAccess';
import { audit, getCountryRules, getSettings, getTenantId, inTransaction, nextNumber } from '@/lib/tenant';
import { formatClientCode } from '@/lib/domain/pricing';

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === '' ? null : v;
}

/** Cumpleaños: solo mes y día (se guarda con un año fijo bisiesto). */
function parseBirthday(formData: FormData): Date | null {
  const month = parseInt(str(formData, 'birthdayMonth'), 10);
  const day = parseInt(str(formData, 'birthdayDay'), 10);
  if (!month || !day) return null;
  return new Date(Date.UTC(2000, month - 1, day));
}

async function validateCommercialTerms(
  country: string,
  shippingCategoryId: string | null,
  serviceFeePercent: number,
) {
  const rules = await getCountryRules();
  const rule = rules.find((r) => r.name === country && r.active);
  if (!rule) throw new Error('Selecciona un país de destino válido');
  if (!Number.isFinite(serviceFeePercent) || serviceFeePercent < 0 || serviceFeePercent > 100) {
    throw new Error('La tasa de servicio debe estar entre 0 y 100');
  }
  if (shippingCategoryId) {
    const category = await prisma.shippingCategory.findUnique({ where: { id: shippingCategoryId } });
    if (!category || category.country !== country) {
      throw new Error('La tarifa de envío no corresponde al país del cliente');
    }
  }
  return rule;
}

/** Código único y permanente: prefijo del país + consecutivo (EC001, PTY004…). */
async function generateClientCode(
  tx: Parameters<Parameters<typeof inTransaction>[0]>[0],
  tenantId: string,
  prefix: string,
) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = await nextNumber(tx, tenantId, 'client');
    const code = formatClientCode(prefix, n);
    const taken = await tx.client.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (!taken) return code;
  }
  throw new Error('No se pudo generar un código de cliente');
}

export const createClient = safe(async function createClient(formData: FormData) {
  const user = await requireStaff();

  const name = str(formData, 'name');
  const country = str(formData, 'country');
  const city = str(formData, 'city');
  const phone = str(formData, 'phone');
  if (!name || !country || !phone) throw new Error('Nombre, teléfono y país son obligatorios');

  const settings = await getSettings();
  const serviceParsed = parseFloat(str(formData, 'serviceFeePercent'));
  const serviceFeePercent = Number.isNaN(serviceParsed) ? settings.personalShopperRatePercent : serviceParsed;
  const shippingCategoryId = optional(formData, 'shippingCategoryId');
  const rule = await validateCommercialTerms(country, shippingCategoryId, serviceFeePercent);

  const email = optional(formData, 'email')?.toLowerCase() ?? null;
  if (email) await assertEmailFree(email);

  const referredById = optional(formData, 'referredById');
  const tenantId = await getTenantId();

  const client = await inTransaction(async (tx) => {
    const code = await generateClientCode(tx, tenantId, rule.codePrefix);
    const created = await tx.client.create({
      data: {
        tenantId,
        code,
        name,
        idNumber: optional(formData, 'idNumber'),
        email,
        country,
        city,
        phone,
        birthday: parseBirthday(formData),
        notes: optional(formData, 'notes'),
        deliveryMethod: formData.get('deliveryMethod') === 'HOME_DELIVERY' ? 'HOME_DELIVERY' : 'STORE_PICKUP',
        deliveryAddress: optional(formData, 'deliveryAddress'),
        serviceFeePercent,
        shippingCategoryId,
        referredById,
      },
    });
    await audit(tx, { userName: user.name, action: 'client.create', entity: 'Client', entityId: created.id, data: { code } });
    return created;
  });

  revalidatePath('/clientes');
  return { success: true, clientId: client.id, code: client.code };
});

export const updateClient = safe(async function updateClient(id: string, formData: FormData) {
  const user = await requireStaff();

  const existing = await prisma.client.findUnique({
    where: { id },
    include: { referralBenefitGenerated: { select: { id: true } } },
  });
  if (!existing) throw new Error('Cliente no encontrado');

  const name = str(formData, 'name');
  const country = str(formData, 'country');
  if (!name || !country) throw new Error('Nombre y país son obligatorios');

  const serviceFeePercent = parseFloat(str(formData, 'serviceFeePercent'));
  const shippingCategoryId = optional(formData, 'shippingCategoryId');
  await validateCommercialTerms(country, shippingCategoryId, serviceFeePercent);

  const email = optional(formData, 'email')?.toLowerCase() ?? null;
  if (email && email !== existing.email) await assertEmailFree(email, id);

  let referredById = optional(formData, 'referredById');
  if (referredById === id) throw new Error('Un cliente no puede referirse a sí mismo');
  // Si el referido ya generó su beneficio, el vínculo queda fijo.
  if (existing.referralBenefitGenerated) referredById = existing.referredById;

  await prisma.client.update({
    where: { id },
    data: {
      name,
      idNumber: optional(formData, 'idNumber'),
      email,
      country,
      city: str(formData, 'city'),
      phone: str(formData, 'phone'),
      birthday: parseBirthday(formData),
      notes: optional(formData, 'notes'),
      deliveryMethod: formData.get('deliveryMethod') === 'HOME_DELIVERY' ? 'HOME_DELIVERY' : 'STORE_PICKUP',
      deliveryAddress: optional(formData, 'deliveryAddress'),
      serviceFeePercent,
      shippingCategoryId,
      referredById,
    },
  });
  await audit(prisma, { userName: user.name, action: 'client.update', entity: 'Client', entityId: id });

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  return { success: true };
});
