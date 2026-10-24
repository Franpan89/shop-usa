'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ActionButton from '@/components/ui/ActionButton';
import { toast } from '@/components/ui/Toast';
import { createExpense, deleteExpense, updateExpense } from '@/app/actions/expenses';
import { CATEGORY_LABEL } from './categories';

export interface ExpenseRow {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  category: string;
  description: string;
  country: string;
  originalAmount: number;
  adjustedAmount: number;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Alta y edición de un gasto: el mismo formulario sirve para ambos. */
export function ExpenseModal({
  expense,
  countries,
  trigger,
  triggerClassName = 'btn btn-mint',
  triggerTitle,
}: {
  expense?: ExpenseRow;
  countries: string[];
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(expense?.date ?? today());
  const [category, setCategory] = useState(expense?.category ?? 'LOGISTICS');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [country, setCountry] = useState(expense?.country ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.originalAmount) : '');
  const [adjusted, setAdjusted] = useState(expense && expense.adjustedAmount !== expense.originalAmount ? String(expense.adjustedAmount) : '');

  function openModal() {
    // Al reabrir se parte de los datos guardados, no de una edición cancelada.
    setDate(expense?.date ?? today());
    setCategory(expense?.category ?? 'LOGISTICS');
    setDescription(expense?.description ?? '');
    setCountry(expense?.country ?? '');
    setAmount(expense ? String(expense.originalAmount) : '');
    setAdjusted(expense && expense.adjustedAmount !== expense.originalAmount ? String(expense.adjustedAmount) : '');
    setOpen(true);
  }

  function submit() {
    const payload = {
      expenseDate: date,
      category,
      description,
      country,
      originalAmount: parseFloat(amount),
      adjustedAmount: adjusted.trim() === '' ? null : parseFloat(adjusted),
    };
    startTransition(async () => {
      try {
        const res = expense ? await updateExpense(expense.id, payload) : await createExpense(payload);
        if (!res.ok) {
          toast(res.error, 'error');
          return;
        }
        toast(expense ? 'Gasto actualizado' : 'Gasto registrado', 'success');
        setOpen(false);
        router.refresh();
      } catch {
        toast('No se pudo guardar el gasto. Intenta de nuevo.', 'error');
      }
    });
  }

  return (
    <>
      <button type="button" className={triggerClassName} title={triggerTitle} onClick={openModal}>{trigger}</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={expense ? 'Editar gasto' : 'Registrar gasto'}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="form-grid">
            <div className="input-container">
              <label>Fecha *</label>
              <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="input-container">
              <label>Categoría *</label>
              <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="input-container">
              <label>Valor ($) *</label>
              <input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            </div>
            <div className="input-container">
              <label>Valor ajustado ($)</label>
              <input type="number" step="0.01" min="0" className="input-field" value={adjusted} onChange={(e) => setAdjusted(e.target.value)} placeholder="Igual al valor" />
            </div>
            <div className="input-container">
              <label>País</label>
              <select className="input-field" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">General</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-container">
            <label>Descripción *</label>
            <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej.: Flete aéreo semana 42" required />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-mint" disabled={pending}>{pending ? '⏳…' : expense ? 'Guardar cambios' : 'Registrar gasto'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteExpenseButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  return (
    <ActionButton
      className="btn btn-secondary"
      title="Eliminar"
      confirm={`¿Eliminar el gasto "${description}"? Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
      action={() => deleteExpense(id)}
      success="Gasto eliminado"
      onDone={() => router.refresh()}
    >
      🗑️
    </ActionButton>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => window.print()}>📄 Reporte PDF</button>
  );
}
