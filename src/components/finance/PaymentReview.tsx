'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { toast } from '@/components/ui/Toast';
import { approvePayment, rejectPayment } from '@/app/actions/payments';

/**
 * Verificación de un comprobante (2.9). Subir un comprobante NO significa que Shop USA recibió el
 * dinero: el equipo confirma que está en la cuenta y recién entonces aprueba el pago.
 */
export default function PaymentReview({ paymentId, amount }: { paymentId: string; amount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<'approve' | 'reject' | null>(null);
  const [value, setValue] = useState(amount.toFixed(2));
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  function done(message: string) {
    toast(message, 'success');
    setOpen(null);
    router.refresh();
  }

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-success btn-sm" onClick={() => setOpen('approve')}>✓ Aprobar pago</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen('reject')}>Rechazar</button>
      </div>

      <Modal isOpen={open === 'approve'} onClose={() => setOpen(null)} title="Aprobar pago">
        <div className="stack">
          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            <span>🏦</span>
            <div>Confirma que el dinero ya está en la cuenta de Shop USA. Si el monto recibido es distinto al declarado por el cliente, corrígelo aquí.</div>
          </div>
          <div className="input-container">
            <label>Monto recibido ($)</label>
            <input type="number" step="0.01" min="0.01" className="input-field" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
            <button
              className="btn btn-success"
              disabled={pending || !(parseFloat(value) > 0)}
              onClick={() =>
                startTransition(async () => {
                  const res = await approvePayment(paymentId, parseFloat(value));
                  if (!res.ok) return toast(res.error, 'error');
                  done('Pago aprobado y aplicado a la cuenta');
                })
              }
            >
              {pending ? '⏳…' : 'Aprobar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={open === 'reject'} onClose={() => setOpen(null)} title="Rechazar comprobante">
        <div className="stack">
          <div className="input-container">
            <label>Motivo (se le informa al cliente)</label>
            <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No vemos el depósito en la cuenta" autoFocus />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
            <button
              className="btn btn-danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await rejectPayment(paymentId, reason);
                  if (!res.ok) return toast(res.error, 'error');
                  done('Comprobante rechazado');
                })
              }
            >
              {pending ? '⏳…' : 'Rechazar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
