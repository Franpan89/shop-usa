'use client';

import { useState } from 'react';
import { assignProductToBox } from '../../../actions/orders';

interface BoxOption {
  id: string;
  internalId: string;
  status: string;
}

interface Props {
  productId: string;
  currentBoxId: string | null;
  boxes: BoxOption[];
}

export default function ProductBoxSelect({ productId, currentBoxId, boxes }: Props) {
  const [value, setValue] = useState(currentBoxId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newValue: string) {
    const previous = value;
    setValue(newValue);
    setPending(true);
    setError(null);
    try {
      await assignProductToBox(productId, newValue || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar caja');
      setValue(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <select
        className="input-field"
        style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: '140px' }}
        value={value}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Sin caja</option>
        {boxes.map((b) => (
          <option key={b.id} value={b.id}>
            📦 {b.internalId} {b.status === 'DELIVERED' ? '(Entregada)' : ''}
          </option>
        ))}
      </select>
      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{error}</div>
      )}
    </div>
  );
}
