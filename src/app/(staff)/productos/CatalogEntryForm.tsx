'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

export interface CatalogEntryValues {
  id?: string;
  name: string;
  defaultWeight: number | null;
  defaultPurchaseValue: number | null;
  defaultPurchasedBy: 'CLIENT' | 'SHOPUSA';
  notes: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initial?: Partial<CatalogEntryValues>;
  onSubmit: (values: {
    name: string;
    defaultWeight: number | null;
    defaultPurchaseValue: number | null;
    defaultPurchasedBy: 'CLIENT' | 'SHOPUSA';
    notes: string | null;
  }) => Promise<void>;
}

export default function CatalogEntryForm({ isOpen, onClose, title, initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [weight, setWeight] = useState(initial?.defaultWeight != null ? String(initial.defaultWeight) : '');
  const [purchaseValue, setPurchaseValue] = useState(initial?.defaultPurchaseValue != null ? String(initial.defaultPurchaseValue) : '');
  const [purchasedBy, setPurchasedBy] = useState<'CLIENT' | 'SHOPUSA'>(initial?.defaultPurchasedBy ?? 'CLIENT');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        name,
        defaultWeight: weight.trim() ? parseFloat(weight) : null,
        defaultPurchaseValue: purchaseValue.trim() ? parseFloat(purchaseValue) : null,
        defaultPurchasedBy: purchasedBy,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <div className="input-container">
          <label>Nombre del Producto</label>
          <input
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-container">
            <label>Peso por defecto (lbs)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="input-container">
            <label>Valor por defecto ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={purchaseValue}
              onChange={(e) => setPurchaseValue(e.target.value)}
              placeholder="opcional"
            />
          </div>
        </div>

        <div className="input-container">
          <label>Comprado por (por defecto)</label>
          <select
            className="input-field"
            value={purchasedBy}
            onChange={(e) => setPurchasedBy(e.target.value as 'CLIENT' | 'SHOPUSA')}
          >
            <option value="CLIENT">👤 Cliente</option>
            <option value="SHOPUSA">🏪 ShopUSA</option>
          </select>
        </div>

        <div className="input-container">
          <label>Notas</label>
          <input
            type="text"
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="opcional"
          />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
