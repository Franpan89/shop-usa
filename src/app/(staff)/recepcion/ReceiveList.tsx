'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Thumb from '@/components/ui/Thumb';
import ImageUploader from '@/components/ui/ImageUploader';
import { toast } from '@/components/ui/Toast';
import { receiveProducts, setProductPhoto } from '@/app/actions/purchasing';

export interface ReceiveItem {
  id: string;
  name: string;
  quantity: number;
  imageUrl: string | null;
  origin: 'PERSONAL_SHOPPER' | 'CART';
  orderId: string | null;
  orderCode: string | null;
}

export interface ReceiveGroup {
  clientId: string;
  clientName: string;
  clientCode: string;
  items: ReceiveItem[];
}

/** Lista por cliente con ☐ por producto (3.2): marcar RECIBIDO no requiere volver a escribir nada. */
export default function ReceiveList({ groups }: { groups: ReceiveGroup[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const photoOf = (i: ReceiveItem) => photos[i.id] ?? i.imageUrl;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function setPhoto(item: ReceiveItem, url: string | null) {
    if (!url) return;
    setPhotos((p) => ({ ...p, [item.id]: url }));
    // La foto se guarda de inmediato para no perderla aunque no se marque recibido todavía.
    setProductPhoto(item.id, url).then((res) => {
      if (!res.ok) toast(res.error, 'error');
    });
  }

  function receive(ids: string[]) {
    startTransition(async () => {
      const res = await receiveProducts(ids);
      if (!res.ok) return toast(res.error, 'error');
      toast(`${ids.length} producto(s) recibidos — ya están en el consolidado del cliente`, 'success');
      setSelected(new Set());
      router.refresh();
    });
  }

  const allReceivable = (g: ReceiveGroup) => g.items.filter((i) => photoOf(i));

  return (
    <>
      <div className="alert alert-info"><span>📷</span><div>La <strong>foto es obligatoria</strong>. Si el producto ya tenía una desde el pedido, se conserva; si no, agrégala aquí.</div></div>
      {groups.map((g) => (
        <div key={g.clientId} className="group-card">
          <div className="group-head">
            <div className="row">
              <Link href={`/clientes/${g.clientId}`} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{g.clientName}</Link>
              <span className="badge badge-accent mono">{g.clientCode}</span>
              <span className="muted small">{g.items.length} producto(s)</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  const rec = allReceivable(g);
                  const all = rec.every((i) => next.has(i.id));
                  for (const i of rec) {
                    if (all) next.delete(i.id);
                    else next.add(i.id);
                  }
                  return next;
                })
              }
            >
              Seleccionar los que tienen foto
            </button>
          </div>
          {g.items.map((i) => {
            const photo = photoOf(i);
            return (
              <div key={i.id} className={`group-row${selected.has(i.id) ? ' selected' : ''}`}>
                <input type="checkbox" aria-label={`Recibido: ${i.name}`} disabled={!photo} checked={selected.has(i.id)} onChange={() => toggle(i.id)} style={{ width: 20, height: 20, accentColor: 'var(--accent-color)' }} />
                {photo ? <Thumb src={photo} alt={i.name} /> : <ImageUploader kind="product" compact value={null} onChange={(v) => setPhoto(i, v)} />}
                <div className="grow">
                  <div className="strong">{i.name}{i.quantity > 1 ? ` (x${i.quantity})` : ''}</div>
                  <div className="muted small">
                    {i.origin === 'CART' ? '🛒 Carrito' : '🛍️ Personal Shopper'}
                    {i.orderId && <> · <Link href={`/pedidos/${i.orderId}`} className="link">Pedido {i.orderCode}</Link></>}
                    {!photo && <span style={{ color: 'var(--color-warning)' }}> · falta la foto</span>}
                  </div>
                </div>
                <button className="btn btn-sm" disabled={!photo || pending} onClick={() => receive([i.id])}>✓ Recibido</button>
              </div>
            );
          })}
        </div>
      ))}

      {selected.size > 0 && (
        <div className="sticky-bar">
          <span><strong>{selected.size}</strong> producto(s) seleccionado(s)</span>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Limpiar</button>
            <button className="btn btn-sm" disabled={pending} onClick={() => receive(Array.from(selected))}>{pending ? '⏳…' : `Marcar ${selected.size} como recibidos`}</button>
          </div>
        </div>
      )}
    </>
  );
}
