'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createAdjustment } from '../../../actions/adjustments';

interface NewAdjustmentModalProps {
  clientId: string;
  serviceFeePercent: number;
}

const TAX_RATE = 0.065;

export default function NewAdjustmentModal({ clientId, serviceFeePercent }: NewAdjustmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<'CARGO' | 'CREDITO'>('CARGO');
  const [amount, setAmount] = useState('');
  const [applyTax, setApplyTax] = useState(false);
  const [applyServiceFee, setApplyServiceFee] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const baseAmount = parseFloat(amount) || 0;
  const taxAmount = applyTax ? parseFloat((baseAmount * TAX_RATE).toFixed(2)) : 0;
  const serviceFeeAmount = applyServiceFee
    ? parseFloat(((baseAmount + taxAmount) * serviceFeePercent / 100).toFixed(2))
    : 0;
  const totalAmount = baseAmount + taxAmount + serviceFeeAmount;

  function resetForm() {
    setType('CARGO');
    setAmount('');
    setApplyTax(false);
    setApplyServiceFee(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await createAdjustment(clientId, formData);
      setIsOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar ajuste');
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
              <select
                name="type"
                className="input-field"
                value={type}
                onChange={(e) => setType(e.target.value as 'CARGO' | 'CREDITO')}
                required
              >
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {type === 'CARGO' && (
            <div style={{ borderRadius: '12px', background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)', padding: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: baseAmount > 0 ? '16px' : 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="applyTax"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                  Aplicar impuesto ({(TAX_RATE * 100).toFixed(1)}%)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="applyServiceFee"
                    checked={applyServiceFee}
                    onChange={(e) => setApplyServiceFee(e.target.checked)}
                  />
                  Aplicar service fee ({serviceFeePercent}%)
                </label>
              </div>

              {baseAmount > 0 && (applyTax || applyServiceFee) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid rgba(128,128,128,0.15)', paddingTop: '14px' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monto base</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>${baseAmount.toFixed(2)}</div>
                  </div>
                  {applyTax && (
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impuesto</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>${taxAmount.toFixed(2)}</div>
                    </div>
                  )}
                  {applyServiceFee && (
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service fee</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>${serviceFeeAmount.toFixed(2)}</div>
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total a cargar</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>${totalAmount.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

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
