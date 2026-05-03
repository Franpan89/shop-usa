'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createAdjustment } from '../../actions/adjustments';

interface NewAdjustmentModalProps {
  clientId: string;
}

export default function NewAdjustmentModal({ clientId }: NewAdjustmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await createAdjustment(clientId, formData);
      setIsOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message || 'Error al guardar ajuste');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>
        + Cargo / Crédito
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Agregar Cargo o Crédito">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div className="input-container">
              <label>Fecha</label>
              <input name="date" type="date" className="input-field" defaultValue={today} required />
            </div>

            <div className="input-container">
              <label>Tipo</label>
              <select name="type" className="input-field" required>
                <option value="CARGO">🔴 Cargo (cliente debe)</option>
                <option value="CREDITO">🟢 Crédito (a favor del cliente)</option>
              </select>
            </div>

            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Descripción</label>
              <input
                name="description"
                type="text"
                className="input-field"
                placeholder="Ej: Tarifa especial de envío, Descuento por volumen..."
                required
              />
            </div>

            <div className="input-container">
              <label>Monto ($)</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
