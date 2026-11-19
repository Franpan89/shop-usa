'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ActionButton from '@/components/ui/ActionButton';
import { toast } from '@/components/ui/Toast';
import { MAX_PRINT_BATCH, printGuides } from '@/components/guides/printGuides';
import { setGuideStatus, updateGuide, voidGuide } from '@/app/actions/guides';
import { GUIDE_STATUS, MANUAL_GUIDE_STATUSES, PKG_PREFIX } from '@/lib/domain/guides';

export interface EditableGuide {
  id: string;
  code: string;
  series: 'IFL' | 'PKG';
  status: string;
  contents: string;
  itemCount: number;
  weightLb: number | null;
  declaredValue: number | null;
  clientTracking: string;
  notes: string;
  /** PKG, JM… (vacío en las guías anteriores a los identificadores). */
  refPrefix: string;
  refNumber: number | null;
  refCode: string;
}

export function PrintVisibleButton({ ids }: { ids: string[] }) {
  const over = ids.length > MAX_PRINT_BATCH;
  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={ids.length === 0}
      title={over ? `Se imprimen las primeras ${MAX_PRINT_BATCH}` : undefined}
      onClick={() => {
        if (over) toast(`Se imprimen las primeras ${MAX_PRINT_BATCH} guías; filtra para imprimir el resto.`, 'info');
        printGuides(ids);
      }}
    >
      🖨️ Imprimir las visibles
    </button>
  );
}

/** Reimprimir · Editar · Retener/Liberar · Anular. */
export function GuideRowActions({ guide }: { guide: EditableGuide }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const voided = guide.status === 'VOIDED';
  const isIfl = guide.series === 'IFL';
  const retained = guide.status === 'RETAINED';

  return (
    <div className="row" style={{ gap: 6 }}>
      {!voided && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => printGuides([guide.id])}>Reimprimir</button>
      )}
      {!voided && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Editar</button>
      )}
      {isIfl && !voided && (guide.status === 'CREATED' || retained) && (
        <ActionButton
          className="btn btn-ghost btn-sm"
          success={retained ? 'Guía liberada' : 'Guía retenida en bodega'}
          action={() => setGuideStatus(guide.id, retained ? 'CREATED' : 'RETAINED')}
          onDone={() => router.refresh()}
        >
          {retained ? 'Liberar' : 'Retener'}
        </ActionButton>
      )}
      {isIfl && !voided && guide.status !== 'DELIVERED' && (
        <ActionButton
          className="btn btn-ghost btn-sm"
          prompt={{ label: `¿Anular la guía ${guide.code}? El número no se reutiliza. Motivo (opcional):`, placeholder: 'Ej. error en el destinatario' }}
          confirmLabel="Anular guía"
          success="Guía anulada"
          action={(reason) => voidGuide(guide.id, reason)}
          onDone={() => router.refresh()}
        >
          Anular
        </ActionButton>
      )}
      {/* Se monta solo al abrir: así el formulario siempre arranca con los datos vigentes de la guía. */}
      {editing && <EditGuideModal guide={guide} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditGuideModal({ guide, onClose }: { guide: EditableGuide; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    contents: guide.contents,
    itemCount: String(guide.itemCount),
    weightLb: guide.weightLb != null ? String(guide.weightLb) : '',
    declaredValue: guide.declaredValue != null ? String(guide.declaredValue) : '',
    clientTracking: guide.clientTracking,
    notes: guide.notes,
    pkgNumber: guide.refNumber != null && (!guide.refPrefix || guide.refPrefix === PKG_PREFIX) ? String(guide.refNumber) : '',
  });
  // El PKG se puede corregir; el número de los otros identificadores es consecutivo y queda fijo.
  const pkgEditable = guide.series === 'IFL' && (!guide.refPrefix || guide.refPrefix === PKG_PREFIX);
  const [status, setStatus] = useState(guide.status);
  const isIfl = guide.series === 'IFL';
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    startTransition(async () => {
      const { pkgNumber, ...rest } = f;
      const res = await updateGuide(guide.id, pkgEditable ? { ...rest, refPrefix: PKG_PREFIX, refNumber: pkgNumber } : rest);
      if (!res.ok) return toast(res.error, 'error');
      toast(`Guía ${guide.code} actualizada`, 'success');
      onClose();
      router.refresh();
    });
  }

  function changeStatus(next: string) {
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const res = await setGuideStatus(guide.id, next as 'CREATED');
      if (!res.ok) {
        setStatus(previous);
        return toast(res.error, 'error');
      }
      toast('Estado actualizado', 'success');
      router.refresh();
    });
  }

  return (
    <Modal isOpen onClose={onClose} title={`Editar guía ${guide.code}`}>
      <div className="stack">
        {isIfl && (
          <div className="input-container" style={{ maxWidth: 280 }}>
            <label>Estado</label>
            <select className="input-field" value={status} disabled={pending} onChange={(e) => changeStatus(e.target.value)}>
              {MANUAL_GUIDE_STATUSES.map((s) => (
                <option key={s} value={s}>{GUIDE_STATUS[s].label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-grid">
          {isIfl && (
            <div className="input-container">
              {pkgEditable ? (
                <>
                  <label>Número de PKG</label>
                  <input type="number" min={1} max={99999} step={1} className="input-field" value={f.pkgNumber} onChange={(e) => set('pkgNumber', e.target.value)} />
                </>
              ) : (
                <>
                  <label>Tracking ({guide.refPrefix})</label>
                  <input className="input-field mono" value={guide.refCode} readOnly tabIndex={-1} />
                </>
              )}
            </div>
          )}
          <div className="input-container span-2">
            <label>Contenido</label>
            <input className="input-field" value={f.contents} onChange={(e) => set('contents', e.target.value)} maxLength={160} placeholder={isIfl ? undefined : 'Vacío = se resume solo'} />
          </div>
          {isIfl && (
            <div className="input-container">
              <label>Cantidad de artículos</label>
              <input type="number" min={1} step={1} className="input-field" value={f.itemCount} onChange={(e) => set('itemCount', e.target.value)} />
            </div>
          )}
          <div className="input-container">
            <label>Peso (lb)</label>
            <input type="number" min={0} step="0.01" className="input-field" value={f.weightLb} onChange={(e) => set('weightLb', e.target.value)} />
            {!isIfl && <span className="input-hint">Vacío = suma de los consolidados que lleva la caja.</span>}
          </div>
          {isIfl && (
            <>
              <div className="input-container">
                <label>Valor declarado (USD)</label>
                <input type="number" min={0} step="0.01" className="input-field" value={f.declaredValue} onChange={(e) => set('declaredValue', e.target.value)} />
              </div>
              <div className="input-container">
                <label>Tracking del cliente</label>
                <input className="input-field" value={f.clientTracking} onChange={(e) => set('clientTracking', e.target.value)} />
              </div>
            </>
          )}
          <div className="input-container">
            <label>Notas</label>
            <input className="input-field" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? '⏳…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </Modal>
  );
}
