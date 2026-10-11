'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Thumb from '@/components/ui/Thumb';
import { toast } from '@/components/ui/Toast';
import { markProductsPurchased } from '@/app/actions/purchasing';

export interface PurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  storeName: string | null;
  url: string | null;
  variant: string | null;
  notes: string | null;
}

export interface PurchaseGroup {
  orderId: string;
  orderCode: string;
  typeLabel: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  payment: 'paid' | 'courtesy' | 'unpaid';
  items: PurchaseItem[];
}

const money = (n: number) => `$${n.toFixed(2)}`;

export default function PurchaseList({ groups, selectable }: { groups: PurchaseGroup[]; selectable: boolean }) {
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

  const toggleGroup = (g: PurchaseGroup) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = g.items.every((i) => next.has(i.id));
      for (const i of g.items) {
        if (all) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });

  function buy(ids: string[]) {
    startTransition(async () => {
      const res = await markProductsPurchased(ids);
      if (!res.ok) return toast(res.error, 'error');
      toast(`${ids.length} producto(s) marcados como comprados`, 'success');
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div>
        {groups.map((g) => (
          <div key={g.orderId} className="group-card">
            <div className="group-head">
              <div className="row">
                {selectable && (
                  <input type="checkbox" aria-label={`Seleccionar pedido ${g.orderCode}`} checked={g.items.every((i) => selected.has(i.id))} onChange={() => toggleGroup(g)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} />
                )}
                <Link href={`/pedidos/${g.orderId}`} className="link mono strong">{g.orderCode}</Link>
                <span className="muted small">{g.typeLabel}</span>
                <Link href={`/clientes/${g.clientId}`} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{g.clientName}</Link>
                <span className="muted small mono">{g.clientCode}</span>
              </div>
              {g.payment === 'paid' && <span className="auth-pill ok">🟢 Pago aprobado</span>}
              {g.payment === 'courtesy' && <span className="auth-pill ok">🤝 Autorizado a crédito</span>}
              {g.payment === 'unpaid' && <span className="auth-pill no">🔴 Pago pendiente</span>}
            </div>
            {g.items.map((p) => (
              <div key={p.id} className={`group-row${selected.has(p.id) ? ' selected' : ''}`}>
                {selectable && <input type="checkbox" aria-label={`Seleccionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 18, height: 18, accentColor: 'var(--accent-color)' }} />}
                <Thumb src={p.imageUrl} alt={p.name} />
                <div className="grow">
                  <div className="strong">{p.name}{p.quantity > 1 ? ` (x${p.quantity})` : ''}</div>
                  <div className="muted small">
                    {[p.storeName, p.variant, p.notes].filter(Boolean).join(' · ')}
                    {p.url && (
                      <>
                        {' '}· <a href={p.url} target="_blank" rel="noreferrer" className="link">abrir link</a>
                      </>
                    )}
                  </div>
                </div>
                <div className="strong nowrap">{money(p.unitPrice * p.quantity)}</div>
                {selectable && (
                  <button className="btn btn-sm" disabled={pending} onClick={() => buy([p.id])}>🛍️ Comprado</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectable && selected.size > 0 && (
        <div className="sticky-bar">
          <span><strong>{selected.size}</strong> producto(s) seleccionado(s)</span>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Limpiar</button>
            <button className="btn btn-sm" disabled={pending} onClick={() => buy(Array.from(selected))}>{pending ? '⏳…' : `Marcar ${selected.size} como comprados`}</button>
          </div>
        </div>
      )}
    </>
  );
}
