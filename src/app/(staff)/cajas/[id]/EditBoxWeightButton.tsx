'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { updateBoxWeight } from '../../../actions/boxes';

interface Props {
  boxId: string;
  totalWeight: number;
}

export default function EditBoxWeightButton({ boxId, totalWeight }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState(String(totalWeight));

  function openModal() {
    setWeightInput(String(totalWeight));
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await updateBoxWeight(boxId, parseFloat(weightInput) || 0);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el peso');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.9rem' }} title="Editar peso" onClick={openModal}>
        ✏️
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Editar Peso de la Caja">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <div className="input-container">
            <label>⚖️ Peso Total (lbs)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
