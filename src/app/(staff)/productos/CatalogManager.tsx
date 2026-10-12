'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toast';
import ActionButton from '@/components/ui/ActionButton';
import { createCatalogEntry, deleteCatalogEntry, updateCatalogEntry } from '@/app/actions/productCatalog';

export interface CatalogRow {
  id: string;
  name: string;
  price: number | null;
  notes: string | null;
  uses: number;
  lastUsed: string | null;
}

export default function CatalogManager({ rows }: { rows: CatalogRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', price: '', notes: '' });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? 'No se pudo guardar', 'error');
      toast(ok, 'success');
      after?.();
      router.refresh();
    });
  }

  const input = { price: draft.price === '' ? null : parseFloat(draft.price) };

  return (
    <div className="stack">
      <div className="glass-panel static panel">
        <h2 className="panel-title" style={{ marginBottom: 12 }}>Agregar producto frecuente</h2>
        <div className="form-grid">
          <div className="input-container span-2"><label>Nombre</label><input className="input-field" value={editing ? '' : draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!!editing} /></div>
          <div className="input-container"><label>Precio habitual ($)</label><input type="number" step="0.01" className="input-field" value={editing ? '' : draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} disabled={!!editing} /></div>
        </div>
        <button className="btn btn-sm" style={{ marginTop: 12 }} disabled={pending || !!editing || !draft.name.trim()} onClick={() => run(() => createCatalogEntry({ name: draft.name, defaultPurchaseValue: input.price, notes: draft.notes || null }), 'Producto agregado', () => setDraft({ name: '', price: '', notes: '' }))}>Agregar</button>
      </div>

      <div className="glass-panel static table-container">
        <table className="data-table compact">
          <thead><tr><th>PRODUCTO</th><th className="text-right">PRECIO HABITUAL</th><th>USOS</th><th>ÚLTIMO USO</th><th /></tr></thead>
          <tbody>
            {rows.map((r) =>
              editing === r.id ? (
                <tr key={r.id}>
                  <td><input className="input-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                  <td><input type="number" step="0.01" className="input-field" style={{ width: 110 }} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></td>
                  <td colSpan={2} />
                  <td className="nowrap">
                    <button className="btn btn-sm" disabled={pending} onClick={() => run(() => updateCatalogEntry(r.id, { name: draft.name, defaultPurchaseValue: input.price, notes: r.notes }), 'Guardado', () => setEditing(null))}>Guardar</button>{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="strong">{r.name}</td>
                  <td className="text-right">{r.price != null ? `$${r.price.toFixed(2)}` : '—'}</td>
                  <td>{r.uses}</td>
                  <td className="muted small">{r.lastUsed ?? '—'}</td>
                  <td className="nowrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r.id); setDraft({ name: r.name, price: r.price != null ? String(r.price) : '', notes: r.notes ?? '' }); }}>✏️</button>{' '}
                    <ActionButton className="btn btn-ghost btn-sm" confirm={`¿Eliminar "${r.name}" del catálogo?`} success="Eliminado" action={() => deleteCatalogEntry(r.id)} onDone={() => router.refresh()}>🗑️</ActionButton>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty"><div className="icon">🏷️</div><div className="title">El catálogo está vacío</div><div className="small">Se llena solo con los productos de tus pedidos.</div></div>}
      </div>
    </div>
  );
}
