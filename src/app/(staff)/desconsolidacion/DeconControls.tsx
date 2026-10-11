'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Thumb from '@/components/ui/Thumb';
import { toast } from '@/components/ui/Toast';
import { confirmProductsArrived, receivePkgsAtDestination } from '@/app/actions/logistics';
import { setProductIssue } from '@/app/actions/purchasing';

export function PkgSelector({ pkgs }: { pkgs: { id: string; code: string; units: number; status: string; country: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="stack">
      <div className="row">
        {pkgs.map((p) => (
          <label key={p.id} className="group-card" style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', margin: 0, borderColor: selected.has(p.id) ? 'var(--accent-color)' : undefined }}>
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} />
            <div>
              <div className="mono strong">{p.code}</div>
              <div className="muted small">{p.units} u. · {p.country}{p.status === 'AT_DESTINATION' ? ' · ya recibido' : ''}</div>
            </div>
          </label>
        ))}
      </div>
      <div>
        <button
          className="btn"
          disabled={pending || selected.size === 0}
          onClick={() =>
            startTransition(async () => {
              const res = await receivePkgsAtDestination(Array.from(selected));
              if (!res.ok) return toast(res.error, 'error');
              router.push(`/desconsolidacion?pkgs=${Array.from(selected).join(',')}`);
            })
          }
        >
          {pending ? '⏳…' : `Desconsolidar ${selected.size || ''} PKG recibido(s) →`}
        </button>
      </div>
    </div>
  );
}

export interface DeconItem {
  id: string;
  name: string;
  quantity: number;
  imageUrl: string | null;
  pkgCode: string;
  done: boolean;
  issueNote: string | null;
}

export interface DeconGroup {
  clientId: string;
  clientName: string;
  clientCode: string;
  balance: number;
  authorized: boolean;
  items: DeconItem[];
}

/** Mercancía agrupada por cliente: una sola funda por persona aunque sus productos vengan en varios PKG (8.19). */
export function DeconList({ groups }: { groups: DeconGroup[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function confirm(ids: string[]) {
    startTransition(async () => {
      const res = await confirmProductsArrived(ids);
      if (!res.ok) return toast(res.error, 'error');
      toast(`${ids.length} producto(s) confirmados — listos para retirar`, 'success');
      setChecked(new Set());
      router.refresh();
    });
  }

  function flagMissing(item: DeconItem) {
    const note = window.prompt(`¿Qué pasó con "${item.name}"? (ej. no se encontró en ${item.pkgCode})`, item.issueNote ?? `No se encontró en ${item.pkgCode}`);
    if (note === null) return;
    startTransition(async () => {
      const res = await setProductIssue(item.id, note || null);
      if (!res.ok) return toast(res.error, 'error');
      router.refresh();
    });
  }

  return (
    <>
      {groups.map((g) => {
        const pendingItems = g.items.filter((i) => !i.done);
        const total = g.items.reduce((s, i) => s + i.quantity, 0);
        return (
          <div key={g.clientId} className="group-card">
            <div className="group-head">
              <div className="row">
                <Link href={`/clientes/${g.clientId}`} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{g.clientName}</Link>
                <span className="badge badge-accent mono badge-sm">{g.clientCode}</span>
                <span className="muted small">Total recibido para este cliente: <strong>{total} unidad(es)</strong></span>
              </div>
              <div className="row">
                <span className={`auth-pill ${g.authorized ? 'ok' : 'no'}`}>{g.authorized ? '🟢 Autorizado para entrega' : `🔴 No entregar · saldo $${g.balance.toFixed(2)}`}</span>
                {pendingItems.length > 0 && <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => confirm(pendingItems.map((i) => i.id))}>✓ Todo encontrado</button>}
              </div>
            </div>
            {g.items.map((i) => (
              <div key={i.id} className={`group-row${checked.has(i.id) ? ' selected' : ''}`} style={i.done ? { opacity: 0.6 } : undefined}>
                {i.done ? <span style={{ width: 18, textAlign: 'center' }}>✅</span> : <input type="checkbox" checked={checked.has(i.id)} onChange={() => toggle(i.id)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} aria-label={i.name} />}
                <Thumb src={i.imageUrl} alt={i.name} />
                <div className="grow">
                  <div className="strong">{i.name}{i.quantity > 1 ? ` (x${i.quantity})` : ''}</div>
                  <div className="muted small">Debe estar en <span className="mono strong">{i.pkgCode}</span>{i.issueNote && <span style={{ color: '#ef4444' }}> · ⚠️ {i.issueNote}</span>}</div>
                </div>
                {!i.done && <button className="btn btn-ghost btn-sm" onClick={() => flagMissing(i)}>Faltante</button>}
              </div>
            ))}
          </div>
        );
      })}
      {checked.size > 0 && (
        <div className="sticky-bar">
          <span><strong>{checked.size}</strong> producto(s) encontrados</span>
          <button className="btn btn-sm" disabled={pending} onClick={() => confirm(Array.from(checked))}>{pending ? '⏳…' : 'Confirmar recibidos'}</button>
        </div>
      )}
    </>
  );
}
