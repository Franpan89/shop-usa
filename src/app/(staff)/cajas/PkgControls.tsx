'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ActionButton from '@/components/ui/ActionButton';
import ActionForm from '@/components/ui/ActionForm';
import Thumb from '@/components/ui/Thumb';
import { toast } from '@/components/ui/Toast';
import {
  assignProductsToPkg,
  closePkg,
  createPkg,
  deletePkg,
  moveProductToPkg,
  removeProductFromPkg,
  reopenPkg,
  setPkgStatus,
  updatePkgInfo,
} from '@/app/actions/logistics';

export function NewPkgButton({ countries, suggested }: { countries: string[]; suggested: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(countries[0] ?? '');
  const [number, setNumber] = useState(String(suggested));
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn btn-mint" onClick={() => setOpen(true)}>+ Nuevo PKG</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nuevo PKG">
        <div className="stack">
          <div className="form-grid">
            <div className="input-container">
              <label>País de destino</label>
              <select className="input-field" value={country} onChange={(e) => setCountry(e.target.value)}>
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="input-container">
              <label>Número de PKG</label>
              <input type="number" className="input-field" value={number} onChange={(e) => setNumber(e.target.value)} />
              <span className="input-hint">Sugerido: PKG{suggested}. Puedes cambiarlo; no se permiten repetidos.</span>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !country}
              onClick={() =>
                startTransition(async () => {
                  const res = await createPkg({ country, number: parseInt(number, 10) || undefined });
                  if (!res.ok) return toast(res.error, 'error');
                  toast('PKG creado', 'success');
                  setOpen(false);
                  router.push(`/cajas/${res.pkgId}`);
                })
              }
            >
              {pending ? '⏳…' : 'Crear PKG'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export interface PoolGroup {
  clientId: string;
  clientName: string;
  clientCode: string;
  items: { id: string; name: string; quantity: number; imageUrl: string | null; authorized: boolean; balance: number }[];
}

/** Productos listos para despacho que todavía no están en ningún PKG (8.7). */
export function PkgPool({ pkgId, groups }: { pkgId: string; groups: PoolGroup[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function add() {
    startTransition(async () => {
      const res = await assignProductsToPkg(pkgId, Array.from(selected));
      if (!res.ok) return toast(res.error, 'error');
      toast(`${selected.size} producto(s) agregados al PKG`, 'success');
      setSelected(new Set());
      router.refresh();
    });
  }

  if (groups.length === 0) return <div className="empty"><div className="icon">✅</div><div className="title">No hay productos pendientes de asignación</div></div>;

  return (
    <>
      {groups.map((g) => (
        <div key={g.clientId} className="group-card">
          <div className="group-head">
            <div className="row">
              <strong>{g.clientName}</strong>
              <span className="badge badge-accent mono badge-sm">{g.clientCode}</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  const ok = g.items.filter((i) => i.authorized);
                  const all = ok.every((i) => next.has(i.id));
                  for (const i of ok) {
                    if (all) next.delete(i.id);
                    else next.add(i.id);
                  }
                  return next;
                })
              }
            >
              Todos
            </button>
          </div>
          {g.items.map((i) => (
            <div key={i.id} className={`group-row${selected.has(i.id) ? ' selected' : ''}${i.authorized ? '' : ' disabled'}`}>
              <input type="checkbox" disabled={!i.authorized} checked={selected.has(i.id)} onChange={() => toggle(i.id)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} aria-label={i.name} />
              <Thumb src={i.imageUrl} alt={i.name} />
              <div className="grow">
                <div className="strong">{i.name}{i.quantity > 1 ? ` (x${i.quantity})` : ''}</div>
                {!i.authorized && <span className="auth-pill no" style={{ marginTop: 4 }}>🔴 No autorizado · saldo ${i.balance.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {selected.size > 0 && (
        <div className="sticky-bar">
          <span><strong>{selected.size}</strong> seleccionado(s)</span>
          <button className="btn btn-sm" disabled={pending} onClick={add}>{pending ? '⏳…' : 'Agregar al PKG'}</button>
        </div>
      )}
    </>
  );
}

export function PkgItemActions({ productId, others, editable }: { productId: string; others: { id: string; label: string }[]; editable: boolean }) {
  const router = useRouter();
  if (!editable) return null;
  return (
    <div className="row" style={{ gap: 6 }}>
      {others.length > 0 && (
        <select
          className="input-field"
          defaultValue=""
          style={{ padding: '5px 8px', fontSize: '0.8rem' }}
          aria-label="Mover a otro PKG"
          onChange={async (e) => {
            if (!e.target.value) return;
            const res = await moveProductToPkg(productId, e.target.value);
            if (!res.ok) toast(res.error, 'error');
            else {
              toast('Producto movido', 'success');
              router.refresh();
            }
          }}
        >
          <option value="">Mover a…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <ActionButton className="btn btn-ghost btn-sm" success="Producto retirado del PKG" action={() => removeProductFromPkg(productId)} title="Retirar del PKG">✕</ActionButton>
    </div>
  );
}

export function PkgStateButtons({ pkgId, status, canClose, hasDispatch }: { pkgId: string; status: string; canClose: boolean; hasDispatch: boolean }) {
  const router = useRouter();
  return (
    <div className="row">
      {status === 'IN_PREPARATION' && (
        <>
          <ActionButton className="btn btn-sm" disabled={!canClose} title={canClose ? undefined : 'Agrega productos primero'} success="PKG cerrado" confirm="Una vez cerrado el contenido se conserva. ¿Cerrar el PKG?" action={() => closePkg(pkgId)}>Cerrar PKG</ActionButton>
          {!canClose && (
            <ActionButton
              className="btn btn-ghost btn-sm"
              confirm="¿Eliminar este PKG vacío?"
              action={async () => {
                const res = await deletePkg(pkgId);
                if (res.ok) router.push('/cajas');
                return res;
              }}
            >
              Eliminar
            </ActionButton>
          )}
        </>
      )}
      {status === 'CLOSED' && !hasDispatch && (
        <ActionButton className="btn btn-secondary btn-sm" success="PKG reabierto" action={() => reopenPkg(pkgId)}>Reabrir para corregir</ActionButton>
      )}
    </div>
  );
}

const MANUAL_STATUSES = [
  ['IN_TRANSIT', 'En tránsito'],
  ['AT_DESTINATION', 'En destino / aduana'],
  ['READY_FOR_PICKUP', 'Listo para retirar'],
  ['DELIVERED', 'Entregado'],
] as const;

/** UNA actualización del PKG se refleja en todos sus productos (6.5). */
export function PkgStatusControl({ pkgId, status }: { pkgId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="input-container">
      <label>Estado del PKG (actualiza todos sus productos)</label>
      <select
        className="input-field"
        value={status}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await setPkgStatus(pkgId, e.target.value as 'IN_TRANSIT');
            if (!res.ok) return toast(res.error, 'error');
            toast('Estado actualizado en todos los productos del PKG', 'success');
            router.refresh();
          })
        }
      >
        {!MANUAL_STATUSES.some(([v]) => v === status) && <option value={status}>{status}</option>}
        {MANUAL_STATUSES.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

export function PkgInfoForm({ pkgId, number, trackingNumber, carrier, notes, numberEditable }: { pkgId: string; number: number; trackingNumber: string | null; carrier: string | null; notes: string | null; numberEditable: boolean }) {
  const router = useRouter();
  return (
    <ActionForm
      action={(fd) =>
        updatePkgInfo(pkgId, {
          number: numberEditable ? parseInt(String(fd.get('number')), 10) : undefined,
          trackingNumber: String(fd.get('trackingNumber') ?? ''),
          carrier: String(fd.get('carrier') ?? ''),
          notes: String(fd.get('notes') ?? ''),
        })
      }
      success="PKG actualizado"
      onSuccess={() => router.refresh()}
    >
      <div className="stack">
        {numberEditable && (
          <div className="input-container">
            <label>Número de PKG</label>
            <input name="number" type="number" className="input-field" defaultValue={number} />
          </div>
        )}
        <div className="input-container">
          <label>Número de guía</label>
          <input name="trackingNumber" className="input-field" defaultValue={trackingNumber ?? ''} placeholder="Referencia de la transportadora" />
          <span className="input-hint">Con la guía consultas el tracking directamente en la transportadora.</span>
        </div>
        <div className="input-container">
          <label>Transportadora (opcional)</label>
          <input name="carrier" className="input-field" defaultValue={carrier ?? ''} />
        </div>
        <div className="input-container">
          <label>Notas</label>
          <input name="notes" className="input-field" defaultValue={notes ?? ''} />
        </div>
        <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>Guardar</button>
      </div>
    </ActionForm>
  );
}
