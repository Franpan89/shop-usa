'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { registerPayment } from '../../actions/orders';

interface Props {
  orderId: string;
  balance: number;
}

export default function RegisterPaymentButton({ orderId, balance }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await registerPayment(orderId, parseFloat(amount));
      setOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al registrar pago');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="btn"
        onClick={() => {
          setAmount(balance > 0 ? balance.toFixed(2) : '');
          setOpen(true);
        }}
        disabled={balance <= 0}
        title={balance <= 0 ? 'Sin balance pendiente' : 'Registrar un pago'}
      >
        💳 Registrar Pago
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Registrar Pago">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
            Balance pendiente: <strong style={{ color: balance > 0 ? '#ef4444' : '#10b981' }}>${balance.toFixed(2)}</strong>
          </p>
          <div className="input-container">
            <label>Monto del pago ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input-field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Guardando…' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
