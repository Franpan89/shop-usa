'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import ClientPicker from '@/components/ui/ClientPicker';
import { toast } from '@/components/ui/Toast';
import { printGuides } from '@/components/guides/printGuides';
import { createGuide } from '@/app/actions/guides';
import { ConsigneeForm, ShipperForm } from '../PartyForms';

export interface ShipperOption {
  id: string;
  name: string;
  idNumber: string | null;
  city: string | null;
}

export interface ConsigneeOption {
  id: string;
  shipperId: string;
  name: string;
  idNumber: string | null;
  city: string | null;
}

interface Recent {
  id: string;
  code: string;
  to: string;
}

const PREF_PRINT = 'guides.printOnCreate';
const PREF_KEEP = 'guides.keepShipper';

// Las preferencias viven en este navegador (cada puesto tiene su impresora y su costumbre).
// Si el almacenamiento está bloqueado, se conservan en memoria mientras la pestaña siga abierta.
const memoryPrefs = new Map<string, boolean>();

function readPref(key: string, fallback: boolean) {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v === '1';
  } catch {
    /* sin almacenamiento */
  }
  return memoryPrefs.get(key) ?? fallback;
}

function useLocalPref(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const subscribe = useCallback(
    (notify: () => void) => {
      window.addEventListener('storage', notify);
      window.addEventListener(`pref:${key}`, notify);
      return () => {
        window.removeEventListener('storage', notify);
        window.removeEventListener(`pref:${key}`, notify);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(subscribe, () => readPref(key, fallback), () => fallback);
  const set = useCallback(
    (next: boolean) => {
      memoryPrefs.set(key, next);
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* queda en memoria */
      }
      window.dispatchEvent(new Event(`pref:${key}`));
    },
    [key],
  );
  return [value, set];
}

const EMPTY = { contents: '', itemCount: '1', weightLb: '', declaredValue: '', clientTracking: '', notes: '', deliverElsewhere: false, finalDeliveryAddress: '', retain: false };

export default function CreateGuideForm({
  shippers: initialShippers,
  consignees: initialConsignees,
  countries,
  initialShipperId = '',
}: {
  shippers: ShipperOption[];
  consignees: ConsigneeOption[];
  countries: string[];
  initialShipperId?: string;
}) {
  const [shippers, setShippers] = useState(initialShippers);
  const [consignees, setConsignees] = useState(initialConsignees);
  const [shipperId, setShipperId] = useState(initialShipperId);
  const [consigneeId, setConsigneeId] = useState('');
  const [fields, setFields] = useState(EMPTY);
  const [printOnCreate, setPrintOnCreate] = useLocalPref(PREF_PRINT, true);
  const [keepShipper, setKeepShipper] = useLocalPref(PREF_KEEP, false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [focus, setFocus] = useState<{ nonce: number; target: 'shipper' | 'consignee' }>({ nonce: 0, target: initialShipperId ? 'consignee' : 'shipper' });
  const [modal, setModal] = useState<'shipper' | 'consignee' | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setFields((f) => ({ ...f, [key]: value }));

  const shipperOptions = useMemo(
    () => shippers.map((s) => ({ id: s.id, name: s.name, code: s.idNumber ?? s.city ?? '—' })),
    [shippers],
  );
  const consigneeOptions = useMemo(
    () => consignees.filter((c) => c.shipperId === shipperId).map((c) => ({ id: c.id, name: c.name, code: c.city ?? c.idNumber ?? '—' })),
    [consignees, shipperId],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const res = await createGuide({ shipperId, consigneeId, ...fields });
      if (!res.ok) return toast(res.error, 'error');
      const to = consignees.find((c) => c.id === consigneeId)?.name ?? '';
      toast(`Guía ${res.code} creada`, 'success');
      setRecent((r) => [{ id: res.guideId, code: res.code, to }, ...r].slice(0, 6));
      if (printOnCreate) printGuides([res.guideId]);
      setFields(EMPTY);
      setConsigneeId('');
      if (!keepShipper) setShipperId('');
      setFocus((f) => ({ nonce: f.nonce + 1, target: keepShipper ? 'consignee' : 'shipper' }));
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="glass-panel static panel" aria-busy={pending}>
        <fieldset disabled={pending} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <div className="stack-sm">
              <ClientPicker
                key={`s${focus.nonce}`}
                label="Remitente"
                clients={shipperOptions}
                value={shipperId}
                onChange={(id) => {
                  setShipperId(id);
                  setConsigneeId('');
                  // El siguiente paso natural: elegir destinatario (el selector se vuelve a montar con el foco).
                  setFocus((f) => ({ nonce: f.nonce, target: 'consignee' }));
                }}
                autoFocus={focus.target === 'shipper'}
                placeholder="Buscar por nombre o identificación…"
              />
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setModal('shipper')}>
                + Nuevo remitente
              </button>
            </div>

            <div className="stack-sm">
              <ClientPicker
                key={`c${focus.nonce}-${shipperId}`}
                label="Destinatario"
                clients={consigneeOptions}
                value={consigneeId}
                onChange={setConsigneeId}
                disabled={!shipperId}
                autoFocus={focus.target === 'consignee' && !!shipperId}
                placeholder={shipperId ? 'Buscar por nombre…' : 'Primero elige el remitente'}
              />
              {shipperId && (
                <>
                  {consigneeOptions.length === 0 && <span className="input-hint">Este remitente todavía no tiene destinatarios.</span>}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setModal('consignee')}>
                    + Nuevo destinatario
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 22 }}>
            <div className="input-container span-2">
              <label htmlFor="g-contents">Contenido</label>
              <input id="g-contents" className="input-field" value={fields.contents} onChange={(e) => set('contents', e.target.value)} placeholder="ZAPATOS PRENDAS DE VESTIR RELOJ" maxLength={160} autoComplete="off" />
            </div>
            <div className="input-container">
              <label htmlFor="g-items">Cantidad de artículos</label>
              <input id="g-items" type="number" min={1} max={999} step={1} className="input-field" value={fields.itemCount} onChange={(e) => set('itemCount', e.target.value)} />
            </div>
            <div className="input-container">
              <label htmlFor="g-weight">Peso (lb)</label>
              <input id="g-weight" type="number" min={0} step="0.01" inputMode="decimal" className="input-field" value={fields.weightLb} onChange={(e) => set('weightLb', e.target.value)} />
            </div>
            <div className="input-container">
              <label htmlFor="g-value">Valor declarado (USD)</label>
              <input id="g-value" type="number" min={0} step="0.01" inputMode="decimal" className="input-field" value={fields.declaredValue} onChange={(e) => set('declaredValue', e.target.value)} />
            </div>
            <div className="input-container">
              <label htmlFor="g-tracking">Tracking del cliente</label>
              <input id="g-tracking" className="input-field" value={fields.clientTracking} onChange={(e) => set('clientTracking', e.target.value)} autoComplete="off" />
              <span className="input-hint">Opcional. Sirve para buscar la guía después.</span>
            </div>
            <div className="input-container">
              <label htmlFor="g-notes">Notas</label>
              <input id="g-notes" className="input-field" value={fields.notes} onChange={(e) => set('notes', e.target.value)} autoComplete="off" />
            </div>
          </div>

          <div className="stack-sm" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <label className="check">
              <input type="checkbox" checked={fields.deliverElsewhere} onChange={(e) => set('deliverElsewhere', e.target.checked)} />
              La entrega final es en otra dirección
            </label>
            {fields.deliverElsewhere && (
              <div className="input-container" style={{ maxWidth: 560 }}>
                <label htmlFor="g-final">Dirección de entrega final</label>
                <input id="g-final" className="input-field" value={fields.finalDeliveryAddress} onChange={(e) => set('finalDeliveryAddress', e.target.value)} autoComplete="off" />
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={fields.retain} onChange={(e) => set('retain', e.target.checked)} />
              Retener en bodega (no despachar todavía)
            </label>
          </div>

          <div className="row" style={{ marginTop: 22, gap: 20 }}>
            <button type="submit" className="btn btn-mint" disabled={pending}>
              {pending ? '⏳ Creando…' : printOnCreate ? 'Crear e imprimir (Enter)' : 'Crear guía (Enter)'}
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={printOnCreate}
                onChange={(e) => setPrintOnCreate(e.target.checked)}
              />
              Imprimir al crear
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={keepShipper}
                onChange={(e) => setKeepShipper(e.target.checked)}
              />
              Seguir con el mismo remitente
            </label>
          </div>
        </fieldset>
      </form>

      {recent.length > 0 && (
        <section className="glass-panel static panel" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <h2 className="panel-title">Creadas ahora</h2>
            <Link href="/guias" className="link small">Ver todas →</Link>
          </div>
          <div className="stack-sm">
            {recent.map((r) => (
              <div key={r.id} className="row-between">
                <span>
                  <strong className="mono">{r.code}</strong> <span className="muted">· {r.to}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => printGuides([r.id])}>🖨️ Reimprimir</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal isOpen={modal === 'shipper'} onClose={() => setModal(null)} title="Nuevo remitente">
        <ShipperForm
          onSaved={(r) => {
            const id = String(r.shipperId);
            setShippers((list) => [...list, { id, name: String(r.name), idNumber: (r.idNumber as string | null) ?? null, city: (r.city as string | null) ?? null }].sort((a, b) => a.name.localeCompare(b.name)));
            setShipperId(id);
            setConsigneeId('');
            setModal(null);
          }}
        />
      </Modal>

      <Modal isOpen={modal === 'consignee'} onClose={() => setModal(null)} title="Nuevo destinatario">
        {shipperId && (
          <ConsigneeForm
            shipperId={shipperId}
            countries={countries}
            onSaved={(r) => {
              const id = String(r.consigneeId);
              setConsignees((list) => [...list, { id, shipperId, name: String(r.name), idNumber: (r.idNumber as string | null) ?? null, city: (r.city as string | null) ?? null }]);
              setConsigneeId(id);
              setModal(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
