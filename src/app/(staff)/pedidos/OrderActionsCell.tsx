'use client';

import { useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { deleteOrder, registerPayment, updateOrderStatus } from '../../actions/orders';
import { normalizeOrderStatus } from '@/lib/orderStatus';

interface Props {
  orderId: string;
  currentBoxId: string | null;
  hasBoxedProduct: boolean;
  currentStatus: string;
  balance: number;
}

export default function OrderActionsCell({ orderId, currentBoxId, hasBoxedProduct, currentStatus, balance }: Props) {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>(balance > 0 ? balance.toFixed(2) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedStatus = normalizeOrderStatus(currentStatus);
  const canShipLoose = normalizedStatus === 'READY_TO_SHIP' && !currentBoxId && !hasBoxedProduct;

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const amount = parseFloat(paymentAmount);
      await registerPayment(orderId, amount);
      setPaymentModalOpen(false);
      setPaymentAmount('');
    } catch (err: any) {
      setError(err.message || 'Error al registrar pago');
    } finally {
      setPending(false);
    }
  }

  async function handleShipLoose() {
    if (pending) return;
    if (!confirm('¿Marcar como enviado sin caja (envío suelto)?')) return;
    setPending(true);
    try {
      await updateOrderStatus(orderId, 'SHIPPED');
    } catch (err: any) {
      alert(err.message || 'Error al marcar enviado');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return;
    setPending(true);
    try {
      await deleteOrder(orderId);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    } finally {
      setPending(false);
    }
  }

  const btnStyle = { padding: '6px 10px', fontSize: '1rem' } as const;

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {canShipLoose && (
        <button
          className="btn btn-secondary"
          style={btnStyle}
          title="Marcar enviado (sin caja)"
          onClick={handleShipLoose}
          disabled={pending}
        >
          🚢
        </button>
      )}
      <button
        className="btn btn-secondary"
        style={btnStyle}
        title="Registrar Pago"
        onClick={() => setPaymentModalOpen(true)}
        disabled={pending || balance <= 0}
      >
        💳
      </button>
      <Link href={`/pedidos/${orderId}`} className="btn btn-secondary" style={btnStyle} title="Ver / Editar / Asignar Caja por Producto">
        ✏️
      </Link>
      <button
        className="btn btn-secondary"
        style={{ ...btnStyle, color: '#ef4444' }}
        title="Eliminar"
        onClick={handleDelete}
        disabled={pending}
      >
        🗑️
      </button>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Registrar Pago">
        <form onSubmit={handlePayment}>
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
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Guardando…' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
