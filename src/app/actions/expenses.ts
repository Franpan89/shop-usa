'use server';

import { safe } from '@/lib/action';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { audit, getTenantId } from '@/lib/tenant';
import { removeReceipts } from '@/lib/storage';

// Un archivo 'use server' solo puede exportar acciones; la lista se repite en el cliente (ExpenseManager).
const EXPENSE_CATEGORIES =['LOGISTICS', 'SUPPLIES', 'SALES', 'OTHER'] as const;
const MAX_RECEIPTS = 12;
// Rutas que genera createUploadTarget: <año>/<uuid>.<ext>. Así nadie puede apuntar a otro archivo del bucket.
const RECEIPT_PATH = /^\d{4}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

interface ExpenseInput {
  expenseDate: string;
  category: string;
  description: string;
  country: string;
  originalAmount: number;
  /** Si no se indica, el valor ajustado es igual al original. */
  adjustedAmount?: number | null;
  /** Fotos del recibo ya subidas a Storage (varias si el recibo es largo). */
  receiptPaths?: string[];
}

function parse(input: ExpenseInput) {
  const description = (input.description ?? '').trim();
  if (!description) throw new Error('Escribe la descripción del gasto');
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new Error('Selecciona una categoría válida');
  const originalAmount = Number(input.originalAmount);
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) throw new Error('El valor del gasto debe ser mayor que 0');
  const adjustedRaw = input.adjustedAmount;
  const adjustedAmount = adjustedRaw === null || adjustedRaw === undefined || Number.isNaN(adjustedRaw) ? originalAmount : Number(adjustedRaw);
  if (!Number.isFinite(adjustedAmount) || adjustedAmount < 0) throw new Error('El valor ajustado no es válido');
  const expenseDate = new Date(`${input.expenseDate}T12:00:00`);
  if (!input.expenseDate || Number.isNaN(expenseDate.getTime())) throw new Error('Indica la fecha del gasto');
  const receiptPaths = Array.from(new Set(input.receiptPaths ?? []));
  if (receiptPaths.length > MAX_RECEIPTS) throw new Error(`Máximo ${MAX_RECEIPTS} fotos por gasto`);
  if (!receiptPaths.every((p) => RECEIPT_PATH.test(p))) throw new Error('Una de las fotos del recibo no es válida');
  return {
    expenseDate,
    category: input.category,
    description,
    country: (input.country ?? '').trim(),
    originalAmount: Math.round(originalAmount * 100) / 100,
    adjustedAmount: Math.round(adjustedAmount * 100) / 100,
    receiptPaths,
  };
}

function revalidateExpenses() {
  revalidatePath('/gastos');
  revalidatePath('/dashboard');
}

export const createExpense = safe(async function createExpense(input: ExpenseInput) {
  const user = await requireStaff();
  const data = parse(input);
  const tenantId = await getTenantId();
  const expense = await prisma.expense.create({ data: { ...data, tenantId } });
  await audit(prisma, { userName: user.name, action: 'expense.create', entity: 'Expense', entityId: expense.id, data: { amount: data.originalAmount, category: data.category } });
  revalidateExpenses();
  return { id: expense.id };
});

export const updateExpense = safe(async function updateExpense(id: string, input: ExpenseInput) {
  const user = await requireStaff();
  const data = parse(input);
  const tenantId = await getTenantId();
  const existing = await prisma.expense.findFirst({ where: { id, tenantId }, select: { receiptPaths: true } });
  if (!existing) throw new Error('El gasto ya no existe');
  await prisma.expense.update({ where: { id }, data });
  // Las fotos que se quitaron al editar se borran del Storage.
  await removeReceipts(existing.receiptPaths.filter((p) => !data.receiptPaths.includes(p)));
  await audit(prisma, { userName: user.name, action: 'expense.update', entity: 'Expense', entityId: id, data: { amount: data.originalAmount, category: data.category } });
  revalidateExpenses();
});

export const deleteExpense = safe(async function deleteExpense(id: string) {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error('El gasto ya no existe');
  await prisma.expense.delete({ where: { id } });
  await removeReceipts(existing.receiptPaths);
  await audit(prisma, { userName: user.name, action: 'expense.delete', entity: 'Expense', entityId: id, data: { amount: existing.originalAmount, description: existing.description } });
  revalidateExpenses();
});
