'use client';

import { useState } from 'react';
import { markBoxArrived, markBoxDelivered } from '../actions/boxes';

interface Props {
  boxId: string;
  boxStatus: string;
  hasOrders: boolean;
  allDelivered: boolean;
  anyArrived: boolean;
}

export default function BoxStatusActions({ boxId, boxStatus, hasOrders, allDelivered, anyArrived }: Props) {
  const [pending, setPending] = useState<'arrived' | 'delivered' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleArrived() {
    if (pending) return;
    if (!confirm('¿Marcar esta caja como “Llegó al país”? Todos los pedidos pasarán a ARRIVED.')) return;
    setPending('arrived');
    setError(null);
    try {
      await markBoxArrived(boxId);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setPending(null);
    }
  }

  async function handleDelivered() {
    if (pending) return;
    if (!confirm('¿Marcar esta caja como entregada? Todos los pedidos pasarán a DELIVERED.')) return;
    setPending('delivered');
    setError(null);
    try {
      await markBoxDelivered(boxId);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setPending(null);
    }
  }

  const isDelivered = boxStatus === 'DELIVERED' || allDelivered;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {error && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>⚠ {error}</div>}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={handleArrived}
          disabled={!hasOrders || isDelivered || pending !== null}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          title={anyArrived ? 'Ya marcada como llegada' : 'Marcar como Llegó al país'}
        >
          {pending === 'arrived' ? '⏳' : '🛬'} Llegó
        </button>
        <button
          onClick={handleDelivered}
          disabled={!hasOrders || isDelivered || pending !== null}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          title={isDelivered ? 'Ya entregada' : 'Marcar como entregada'}
        >
          {pending === 'delivered' ? '⏳' : '✅'} Entregar
        </button>
      </div>
    </div>
  );
}
