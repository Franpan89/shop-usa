'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ClientPicker, { type PickableClient } from '@/components/ui/ClientPicker';
import ActionButton from '@/components/ui/ActionButton';
import { toast } from '@/components/ui/Toast';
import { deleteCustodyPackage, deliverCustodyPackages } from '@/app/actions/custody';
import { setCustodyActive } from '@/app/actions/custody';
import { deliveryFee } from '@/lib/domain/pricing';

export interface CustodyPkgRow {
  id: string;
  sizeLabel: string;
  storeNote: string | null;
  receivedAt: string;
  fee: number;
  status: 'IN_CUSTODY' | 'DELIVERED';
  deliveredLabel: string | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function ActivateCustody({ clients }: { clients: PickableClient[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <div className="row" style={{ alignItems: 'flex-end' }}>
      <div style={{ minWidth: 280, flex: 1 }}>
        <ClientPicker clients={clients} value={clientId} onChange={setClientId} label="Activar custodio para…" />
      </div>
      <div className="input-container">
        <label>Fecha límite del cliente</label>
        <input type="date" className="input-field" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <button
        className="btn"
        disabled={pending || !clientId || !deadline}
        onClick={() =>
          startTransition(async () => {
            const res = await setCustodyActive(clientId, true, deadline);
            if (!res.ok) return toast(res.error, 'error');
            toast('Custodio activado', 'success');
            setClientId('');
            setDeadline('');
            router.refresh();
          })
        }
      >
        Activar
      </button>
    </div>
  );
}

/** Entrega: retiro en oficina o delivery con costo por millas (9.7). */
export function DeliverCustody({
  clientId,
  packages,
  cfg,
}: {
  clientId: string;
  packages: CustodyPkgRow[];
  cfg: { baseFee: number; baseMiles: number; extraPerMile: number };
}) {
  const router = useRouter();
  const inCustody = packages.filter((p) => p.status === 'IN_CUSTODY');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [miles, setMiles] = useState('');
  const [pending, startTransition] = useTransition();
  const fee = method === 'DELIVERY' && miles !== '' ? deliveryFee(parseFloat(miles) || 0, cfg) : 0;
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="stack-sm">
      {packages.map((p) => (
        <div key={p.id} className="group-row" style={{ border: '1px solid var(--border-color)', borderRadius: 12, opacity: p.status === 'DELIVERED' ? 0.6 : 1 }}>
          {p.status === 'IN_CUSTODY' ? (
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} aria-label={`Paquete ${p.sizeLabel}`} />
          ) : (
            <span>✅</span>
          )}
          <div className="grow">
            <div className="strong">{p.sizeLabel}{p.storeNote ? ` · ${p.storeNote}` : ''}</div>
            <div className="muted small">Recibido {p.receivedAt} · cargo {money(p.fee)}{p.deliveredLabel ? ` · ${p.deliveredLabel}` : ''}</div>
          </div>
          {p.status === 'IN_CUSTODY' && (
            <ActionButton className="btn btn-ghost btn-sm" confirm="¿Eliminar este paquete (registrado por error)? Se anula su cargo." success="Paquete eliminado" action={() => deleteCustodyPackage(p.id)}>🗑️</ActionButton>
          )}
        </div>
      ))}

      {inCustody.length > 0 && (
        <div className="row" style={{ marginTop: 6, alignItems: 'flex-end' }}>
          <div className="input-container">
            <label>Entrega</label>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as 'PICKUP' | 'DELIVERY')}>
              <option value="PICKUP">Retiro en oficina</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </div>
          {method === 'DELIVERY' && (
            <div className="input-container">
              <label>Millas</label>
              <input type="number" min="0" step="0.5" className="input-field" style={{ width: 100 }} value={miles} onChange={(e) => setMiles(e.target.value)} />
              <span className="input-hint">{money(cfg.baseFee)} hasta {cfg.baseMiles} mi + {money(cfg.extraPerMile)}/mi adicional → <strong>{money(fee)}</strong></span>
            </div>
          )}
          <button
            className="btn btn-sm"
            disabled={pending || selected.size === 0 || (method === 'DELIVERY' && miles === '')}
            onClick={() =>
              startTransition(async () => {
                const res = await deliverCustodyPackages({ clientId, packageIds: Array.from(selected), method, miles: parseFloat(miles) || 0 });
                if (!res.ok) return toast(res.error, 'error');
                toast(method === 'DELIVERY' ? `Entregado — delivery ${money(res.fee)} agregado a su cuenta` : 'Entrega registrada', 'success');
                setSelected(new Set());
                router.refresh();
              })
            }
          >
            Entregar {selected.size || ''} paquete(s)
          </button>
        </div>
      )}
    </div>
  );
}
