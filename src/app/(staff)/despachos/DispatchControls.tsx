'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ActionButton from '@/components/ui/ActionButton';
import { toast } from '@/components/ui/Toast';
import { addPkgsToDispatch, confirmDispatch, createDispatch, deleteDispatch, removePkgFromDispatch } from '@/app/actions/logistics';

export function NewDispatchButton({ countries }: { countries: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(countries[0] ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>+ Nuevo despacho</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nuevo despacho">
        <div className="stack">
          <p className="muted small">El despacho agrupa los PKG que salen en una fecha hacia un destino. Tú decides cuáles van; nada se asigna solo al “próximo lunes”.</p>
          <div className="form-grid">
            <div className="input-container">
              <label>País de destino</label>
              <select className="input-field" value={country} onChange={(e) => setCountry(e.target.value)}>
                {countries.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-container">
              <label>Fecha de salida</label>
              <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !country || !date}
              onClick={() =>
                startTransition(async () => {
                  const res = await createDispatch({ country, date });
                  if (!res.ok) return toast(res.error, 'error');
                  setOpen(false);
                  router.push(`/despachos/${res.dispatchId}`);
                })
              }
            >
              {pending ? '⏳…' : 'Crear despacho'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AvailablePkgs({ dispatchId, pkgs }: { dispatchId: string; pkgs: { id: string; code: string; units: number; clients: number }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  if (pkgs.length === 0) return <div className="empty"><div className="icon">📦</div><div className="title">No hay PKG cerrados disponibles para este destino</div></div>;
  return (
    <div className="stack-sm">
      {pkgs.map((p) => (
        <label key={p.id} className="group-row" style={{ border: '1px solid var(--border-color)', borderRadius: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
            style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }}
          />
          <span className="mono strong">{p.code}</span>
          <span className="muted small">{p.units} unidad(es) · {p.clients} cliente(s)</span>
        </label>
      ))}
      <button
        className="btn btn-sm"
        style={{ alignSelf: 'flex-start' }}
        disabled={pending || selected.size === 0}
        onClick={() =>
          startTransition(async () => {
            const res = await addPkgsToDispatch(dispatchId, Array.from(selected));
            if (!res.ok) return toast(res.error, 'error');
            toast('PKG agregados al despacho', 'success');
            setSelected(new Set());
            router.refresh();
          })
        }
      >
        Agregar {selected.size || ''} al despacho
      </button>
    </div>
  );
}

export function RemovePkgButton({ pkgId }: { pkgId: string }) {
  return <ActionButton className="btn btn-ghost btn-sm" success="PKG retirado del despacho" action={() => removePkgFromDispatch(pkgId)}>Quitar</ActionButton>;
}

export function ConfirmDispatchButton({ dispatchId, disabled }: { dispatchId: string; disabled: boolean }) {
  return (
    <ActionButton
      className="btn btn-success"
      disabled={disabled}
      confirm="¿Confirmar que este despacho YA salió? Los productos pasarán a EN TRÁNSITO y se avisará a los clientes."
      success="Despacho confirmado — productos en tránsito"
      action={() => confirmDispatch(dispatchId)}
    >
      ✓ Confirmar despacho
    </ActionButton>
  );
}

export function DeleteDispatchButton({ dispatchId }: { dispatchId: string }) {
  const router = useRouter();
  return (
    <ActionButton
      className="btn btn-ghost btn-sm"
      confirm="¿Eliminar este despacho en borrador?"
      action={async () => {
        const res = await deleteDispatch(dispatchId);
        if (res.ok) router.push('/despachos');
        return res;
      }}
    >
      Eliminar
    </ActionButton>
  );
}
