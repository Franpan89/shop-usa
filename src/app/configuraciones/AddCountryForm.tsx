'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { upsertCountryRate } from '../actions/shipping';

interface Props {
  existingCountries: string[];
}

export default function AddCountryForm({ existingCountries }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const country = (formData.get('country') as string).trim();
    if (existingCountries.includes(country)) {
      setError(`Ya existe una tarifa para "${country}".`);
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await upsertCountryRate(formData);
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>+ Agregar País</button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Agregar País">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
            <div className="input-container">
              <label>País</label>
              <input name="country" type="text" className="input-field" placeholder="Ej: Colombia" required />
            </div>
            <div className="input-container">
              <label>Tarifa por 0.5 lbs ($)</label>
              <input name="ratePerHalfLb" type="number" step="0.01" min="0.01" className="input-field" placeholder="4.25" required />
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            El costo de envío se calcula como: <strong>⌈peso / 0.5⌉ × tarifa</strong>
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
