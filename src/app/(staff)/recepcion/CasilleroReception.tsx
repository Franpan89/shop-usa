'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ClientPicker, { type PickableClient } from '@/components/ui/ClientPicker';
import ImageUploader from '@/components/ui/ImageUploader';
import { toast } from '@/components/ui/Toast';
import { createCasilleroItems, registerCustodyPackage } from '@/app/actions/purchasing';

interface CasilleroClient extends PickableClient {
  custodyActive: boolean;
  custodyDeadline: string | null;
  openItems: number;
}

interface Line {
  key: number;
  name: string;
  quantity: string;
  imageUrl: string;
}

let seq = 1;
const emptyLine = (): Line => ({ key: seq++, name: '', quantity: '1', imageUrl: '' });
const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Recepción de Casillero (Etapa 4): búsqueda por nombre o código, y registro rápido con
 * descripción, cantidad y foto obligatorias. Con Custodio activo se clasifica cada paquete (Etapa 9).
 */
export default function CasilleroReception({ clients, fees }: { clients: CasilleroClient[]; fees: { small: number; medium: number; large: number } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [destination, setDestination] = useState<'CUSTODY' | 'INTERNATIONAL'>('INTERNATIONAL');
  const [size, setSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('SMALL');
  const [storeNote, setStoreNote] = useState('');

  const client = clients.find((c) => c.id === clientId);
  const custodyMode = !!client?.custodyActive && destination === 'CUSTODY';
  const fee = { SMALL: fees.small, MEDIUM: fees.medium, LARGE: fees.large }[size];

  const update = (key: number, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const ready = lines.every((l) => l.name.trim() && parseInt(l.quantity, 10) >= 1 && l.imageUrl);

  function saveItems() {
    startTransition(async () => {
      const res = await createCasilleroItems(clientId, lines.map((l) => ({ name: l.name, quantity: parseInt(l.quantity, 10), imageUrl: l.imageUrl })));
      if (!res.ok) return toast(res.error, 'error');
      toast(`${lines.length} producto(s) recibidos en el consolidado de ${client?.name}`, 'success');
      setLines([emptyLine()]);
      router.refresh();
    });
  }

  function saveCustody() {
    startTransition(async () => {
      const res = await registerCustodyPackage({ clientId, size, storeNote });
      if (!res.ok) return toast(res.error, 'error');
      toast(`Paquete en custodia registrado — cargo ${money(fee)}`, 'success');
      setStoreNote('');
      router.refresh();
    });
  }

  return (
    <div className="page-grid">
      <div className="stack">
        <div className="glass-panel static panel">
          <ClientPicker clients={clients} value={clientId} onChange={setClientId} label="¿De quién es el paquete? (nombre o código)" autoFocus placeholder="Ej. EC037 o María…" />
          {client && (
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <span className="badge badge-accent mono">{client.code}</span>
              <span className="badge badge-secondary">{client.country}</span>
              <span className="muted small">{client.openItems} producto(s) en su consolidado abierto</span>
              {client.custodyActive && <span className="badge badge-info">🏠 Custodio activo{client.custodyDeadline ? ` hasta ${new Date(client.custodyDeadline).toLocaleDateString('es-ES')}` : ''}</span>}
            </div>
          )}
        </div>

        {client?.custodyActive && (
          <div className="glass-panel static panel">
            <h2 className="panel-title" style={{ marginBottom: 12 }}>Destino del paquete</h2>
            <div className="stack-sm">
              <label className="check"><input type="radio" name="dest" checked={destination === 'CUSTODY'} onChange={() => setDestination('CUSTODY')} /> Custodio de paquetería — Orlando</label>
              <label className="check"><input type="radio" name="dest" checked={destination === 'INTERNATIONAL'} onChange={() => setDestination('INTERNATIONAL')} /> Despacho internacional</label>
            </div>
          </div>
        )}

        {client && custodyMode && (
          <div className="glass-panel static panel">
            <h2 className="panel-title" style={{ marginBottom: 4 }}>Tamaño visual del paquete</h2>
            <p className="panel-sub" style={{ marginBottom: 12 }}>El paquete permanece cerrado: no se registra ni verifica su contenido.</p>
            <div className="stack-sm">
              {([['SMALL', 'Small', fees.small], ['MEDIUM', 'Medium', fees.medium], ['LARGE', 'Large', fees.large]] as const).map(([v, label, price]) => (
                <label key={v} className="check"><input type="radio" name="size" checked={size === v} onChange={() => setSize(v)} /> {label} — {money(price)}</label>
              ))}
            </div>
            <div className="input-container" style={{ marginTop: 14 }}>
              <label>Tienda / remitente</label>
              <input className="input-field" value={storeNote} onChange={(e) => setStoreNote(e.target.value)} placeholder="Ej. Amazon, Carter's, Target" />
            </div>
            <div className="row-between" style={{ marginTop: 16 }}>
              <div><span className="muted">Cargo por custodia </span><strong style={{ fontSize: '1.3rem' }}>{money(fee)}</strong></div>
              <button className="btn" disabled={pending} onClick={saveCustody}>{pending ? '⏳…' : 'Guardar paquete'}</button>
            </div>
          </div>
        )}

        {client && !custodyMode && (
          <div className="glass-panel static panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Productos recibidos</h2>
                <p className="panel-sub">Descripción, cantidad y foto son obligatorias. Fecha y origen (Casillero) son automáticos.</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setLines((p) => [...p, emptyLine()])}>+ Otro producto</button>
            </div>
            <div className="stack">
              {lines.map((l, idx) => (
                <div key={l.key} className="group-card" style={{ padding: 14 }}>
                  <div className="form-grid">
                    <div className="input-container span-2">
                      <label>Descripción *</label>
                      <input className="input-field" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Zapatos Nike" />
                    </div>
                    <div className="input-container">
                      <label>Cantidad *</label>
                      <input type="number" min="1" className="input-field" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                    </div>
                    <ImageUploader kind="product" label="Foto *" required value={l.imageUrl} onChange={(v) => update(l.key, { imageUrl: v ?? '' })} />
                  </div>
                  {lines.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>Quitar #{idx + 1}</button>
                  )}
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" disabled={pending || !ready} onClick={saveItems}>{pending ? '⏳ Guardando…' : `Guardar ${lines.length} producto(s)`}</button>
            </div>
          </div>
        )}
      </div>

      <aside className="glass-panel static panel">
        <h2 className="panel-title" style={{ marginBottom: 8 }}>Cómo funciona</h2>
        <ul className="muted small" style={{ paddingLeft: 18, display: 'grid', gap: 8 }}>
          <li>El producto nace en el sistema al recibirlo y entra solo al <strong>consolidado abierto</strong> del cliente.</li>
          <li>Casillero <strong>no genera</strong> tax, tasa de servicio ni cobro del producto: solo suma peso.</li>
          <li>Si el cliente tiene <strong>Custodio</strong> activo, cada paquete se clasifica: queda en Orlando o sigue al despacho internacional.</li>
        </ul>
      </aside>
    </div>
  );
}
