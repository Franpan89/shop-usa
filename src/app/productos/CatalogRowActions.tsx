'use client';

import { useState } from 'react';
import CatalogEntryForm from './CatalogEntryForm';
import { updateCatalogEntry, deleteCatalogEntry } from '../actions/productCatalog';

interface Props {
  entry: {
    id: string;
    name: string;
    defaultWeight: number | null;
    defaultPurchaseValue: number | null;
    defaultPurchasedBy: 'CLIENT' | 'SHOPUSA';
    notes: string | null;
  };
}

export default function CatalogRowActions({ entry }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${entry.name}" del catálogo?`)) return;
    setPending(true);
    try {
      await deleteCatalogEntry(entry.id);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        className="btn btn-secondary"
        style={{ padding: '6px 10px', fontSize: '1rem' }}
        title="Editar"
        onClick={() => setEditOpen(true)}
        disabled={pending}
      >
        ✏️
      </button>
      <button
        className="btn btn-secondary"
        style={{ padding: '6px 10px', fontSize: '1rem', color: '#ef4444' }}
        title="Eliminar"
        onClick={handleDelete}
        disabled={pending}
      >
        🗑️
      </button>

      <CatalogEntryForm
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar: ${entry.name}`}
        initial={entry}
        onSubmit={async (values) => {
          await updateCatalogEntry(entry.id, values);
        }}
      />
    </div>
  );
}
