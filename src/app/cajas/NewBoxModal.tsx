'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createBox } from '../actions/boxes';

export default function NewBoxModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalId, setInternalId] = useState('');
  const [size, setSize] = useState('Small');
  const [country, setCountry] = useState('Ecuador');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createBox({ internalId, size, country });
      setIsOpen(false);
      setInternalId('');
      setSize('Small');
      setCountry('Ecuador');
    } catch (err: any) {
      setError(err.message || 'Error al crear caja');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>
        + Nueva Caja
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Nueva Caja">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div className="input-container">
            <label>ID Interno</label>
            <input
              type="text"
              className="input-field"
              value={internalId}
              onChange={(e) => setInternalId(e.target.value)}
              placeholder="Ej: #159"
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-container">
              <label>Tamaño</label>
              <select className="input-field" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
                <option value="XL">XL</option>
              </select>
            </div>
            <div className="input-container">
              <label>País Destino</label>
              <input
                type="text"
                className="input-field"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              />
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            La caja se crea en estado <strong>En Tránsito</strong>. El peso se calculará automáticamente al asignar pedidos.
          </p>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Creando…' : 'Crear Caja'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
