'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createShippingCategory } from '../../actions/shipping';

interface Props {
  existingNames: string[];
}

export default function AddCategoryForm({ existingNames }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    if (existingNames.includes(name)) {
      setError(`Ya existe una categoría llamada "${name}".`);
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await createShippingCategory(formData);
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
      <button className="btn" onClick={() => setIsOpen(true)}>+ Agregar Categoría</button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Agregar Categoría de Envío">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Nombre de la Categoría</label>
              <input name="name" type="text" className="input-field" placeholder="Ej: Ecuador Normal" required />
            </div>
            <div className="input-container">
              <label>País</label>
              <select name="country" className="input-field" required defaultValue="Ecuador">
                <option value="Ecuador">Ecuador</option>
                <option value="Panamá">Panamá</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="input-container">
              <label>Tarifa ($)</label>
              <input name="rate" type="number" step="0.01" min="0.01" className="input-field" placeholder="3.75" required />
            </div>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Unidad</label>
              <select name="unit" className="input-field" defaultValue="HALF_LB">
                <option value="HALF_LB">por 0.5 lbs o fracción</option>
                <option value="LB">por lb o fracción</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            El costo de envío se calcula como: <strong>⌈peso / unidad⌉ × tarifa</strong>
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
