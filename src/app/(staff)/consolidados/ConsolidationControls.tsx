'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ActionButton from '@/components/ui/ActionButton';
import ActionForm from '@/components/ui/ActionForm';
import { toast } from '@/components/ui/Toast';
import { closeConsolidation, closeWeeklyBatch, reopenConsolidation, setConsolidationDecision, setConsolidationWeight } from '@/app/actions/consolidations';
import { saveCutoff } from '@/app/actions/settings';

/** El cliente se pesa una vez: este valor reemplaza al anterior cada vez que se vuelve a pesar todo junto. */
export function WeightEditor({ consolidationId, weight, big }: { consolidationId: string; weight: number; big?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(weight ? weight.toFixed(2) : '');
  const [pending, startTransition] = useTransition();
  const changed = parseFloat(value || '0') !== weight;

  function save() {
    const w = parseFloat(value);
    if (!(w >= 0)) return toast('Peso inválido', 'error');
    startTransition(async () => {
      const res = await setConsolidationWeight(consolidationId, w);
      if (!res.ok) return toast(res.error, 'error');
      toast(`Peso actualizado: ${w.toFixed(2)} lb`, 'success');
      router.refresh();
    });
  }

  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <input
        type="number"
        step="0.01"
        min="0"
        className="input-field"
        value={value}
        placeholder="0.00"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && changed && save()}
        style={{ width: big ? 150 : 96, padding: big ? '12px 14px' : '8px 10px', fontSize: big ? '1.3rem' : undefined, fontWeight: 700 }}
        aria-label="Peso en libras"
      />
      <span className="muted small">lb</span>
      {changed && (
        <button className="btn btn-sm" onClick={save} disabled={pending}>{pending ? '⏳' : 'Guardar'}</button>
      )}
    </div>
  );
}

export function DecisionToggle({ consolidationId, decision }: { consolidationId: string; decision: 'DISPATCH' | 'HOLD' }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <ActionButton className={decision === 'DISPATCH' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'} action={() => setConsolidationDecision(consolidationId, 'DISPATCH')} disabled={decision === 'DISPATCH'}>
        Despachar
      </ActionButton>
      <ActionButton className={decision === 'HOLD' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'} action={() => setConsolidationDecision(consolidationId, 'HOLD')} disabled={decision === 'HOLD'}>
        Retener
      </ActionButton>
    </div>
  );
}

export function CloseButton({ consolidationId, disabledReason }: { consolidationId: string; disabledReason?: string }) {
  return (
    <ActionButton
      className="btn btn-success btn-sm"
      disabled={!!disabledReason}
      title={disabledReason}
      confirm="Se congelan el peso, la tarifa y el valor del envío, y se genera la factura de despacho. Los productos que lleguen después irán a un consolidado nuevo. ¿Cerrar?"
      success="Consolidado cerrado y facturado"
      action={() => closeConsolidation(consolidationId)}
    >
      Cerrar y facturar
    </ActionButton>
  );
}

export function ReopenButton({ consolidationId }: { consolidationId: string }) {
  return (
    <ActionButton className="btn btn-ghost btn-sm" confirm="Se anula la factura de despacho y el consolidado vuelve a quedar abierto. ¿Reabrir?" success="Consolidado reabierto" action={() => reopenConsolidation(consolidationId)}>
      Reabrir
    </ActionButton>
  );
}

/** Cierre semanal: cierra y factura todo lo que no fue retenido (sin respuesta = se despacha). */
export function WeeklyBatchButton({ ready }: { ready: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn"
      disabled={pending || ready === 0}
      onClick={() => {
        if (!window.confirm(`Se cerrarán y facturarán ${ready} consolidado(s) que no fueron retenidos. ¿Continuar?`)) return;
        startTransition(async () => {
          const res = await closeWeeklyBatch();
          if (!res.ok) return toast(res.error, 'error');
          toast(`${res.closed} consolidado(s) cerrados y facturados`, 'success');
          for (const s of res.skipped) toast(`${s.client}: ${s.reason}`, 'error');
          router.refresh();
        });
      }}
    >
      {pending ? '⏳ Cerrando…' : `Cerrar semana (${ready})`}
    </button>
  );
}

/** Fecha y hora límite semanal para que el cliente pida retener (3.11). */
export function CutoffForm({ value }: { value: string }) {
  const router = useRouter();
  return (
    <ActionForm action={saveCutoff} success="Fecha límite guardada" onSuccess={() => router.refresh()}>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="input-container">
          <label>Fecha y hora límite para solicitar retención</label>
          <input type="datetime-local" name="dispatchCutoffAt" className="input-field" defaultValue={value} />
        </div>
        <button className="btn btn-secondary btn-sm" type="submit">Guardar</button>
      </div>
    </ActionForm>
  );
}
