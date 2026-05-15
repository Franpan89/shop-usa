'use client';

import { useState } from 'react';
import { updateOrderStatus } from '../../actions/orders';
import {
  ORDER_STATUSES,
  STATUS_LABEL_ES,
  STATUS_ICON,
  normalizeOrderStatus,
  type OrderStatus,
} from '@/lib/orderStatus';

interface Props {
  orderId: string;
  currentStatus: string;
}

export default function OrderStatusChanger({ orderId, currentStatus }: Props) {
  const current = normalizeOrderStatus(currentStatus);
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: OrderStatus) {
    if (next === current || pending) return;
    setPending(next);
    setError(null);
    try {
      await updateOrderStatus(orderId, next);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado');
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>⚠️ {error}</div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {ORDER_STATUSES.map((s) => {
          const isActive = s === current;
          const isPending = pending === s;
          return (
            <button
              key={s}
              onClick={() => handleChange(s)}
              disabled={isActive || !!pending}
              className={`btn ${isActive ? '' : 'btn-secondary'}`}
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                opacity: isActive ? 1 : 0.85,
                cursor: isActive ? 'default' : 'pointer',
              }}
              title={isActive ? 'Estado actual' : `Marcar como ${STATUS_LABEL_ES[s]}`}
            >
              {isPending ? '⏳' : STATUS_ICON[s]} {STATUS_LABEL_ES[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
