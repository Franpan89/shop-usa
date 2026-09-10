'use client';

import { useState } from 'react';
import { confirmOrderReceived, reportOrderIssue, undoOrderReceipt } from '../../actions/orders';
import { RECEIVED_LABEL_ES, RECEIVED_BADGE_CLASS, RECEIVED_ICON, type ReceivedStatus } from '@/lib/orderStatus';

interface Props {
  orderId: string;
  receivedStatus: string | null;
  receivedNote: string | null;
}

export default function OrderReceivingControl({ orderId, receivedStatus, receivedNote }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await confirmOrderReceived(orderId);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  async function handleReport() {
    if (pending || !note.trim()) return;
    setPending(true);
    setError(null);
    try {
      await reportOrderIssue(orderId, note);
      setReporting(false);
      setNote('');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  async function handleUndo() {
    if (pending) return;
    if (!confirm('¿Deshacer la recepción de este pedido?')) return;
    setPending(true);
    setError(null);
    try {
      await undoOrderReceipt(orderId);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  if (receivedStatus === 'OK' || receivedStatus === 'NOVEDAD') {
    const status = receivedStatus as ReceivedStatus;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
        {error && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>⚠ {error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className={`badge ${RECEIVED_BADGE_CLASS[status]}`}>
            {RECEIVED_ICON[status]} {RECEIVED_LABEL_ES[status]}
          </span>
          {receivedNote && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              &ldquo;{receivedNote}&rdquo;
            </span>
          )}
          <button
            onClick={handleUndo}
            disabled={pending}
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
          >
            {pending ? '⏳' : '↩️ Deshacer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {error && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>⚠ {error}</div>}
      {reporting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe la novedad (ej. falta un artículo, empaque dañado, producto incorrecto...)"
            className="input-field"
            style={{ height: '70px', resize: 'vertical', padding: '10px', fontSize: '0.85rem' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReport}
              disabled={pending || !note.trim()}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            >
              {pending ? '⏳' : '⚠️'} Enviar Novedad
            </button>
            <button
              onClick={() => { setReporting(false); setNote(''); setError(null); }}
              disabled={pending}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            {pending ? '⏳' : '✅'} Confirmar Recibido
          </button>
          <button
            onClick={() => setReporting(true)}
            disabled={pending}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            ⚠️ Reportar Novedad
          </button>
        </div>
      )}
    </div>
  );
}
