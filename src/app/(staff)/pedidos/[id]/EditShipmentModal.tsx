'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { updateOrderShipment } from '../../../actions/orders';

interface Props {
  orderId: string;
  weight: number;
  shippingCost: number;
  shippingRate: number;
  shippingUnit: 'HALF_LB' | 'LB';
}

function calcAutoShipping(weight: string, rate: number, unit: 'HALF_LB' | 'LB'): string {
  const w = parseFloat(weight);
  if (!w || w <= 0 || !rate) return '';
  const divisor = unit === 'LB' ? 1 : 0.5;
  const units = Math.ceil(w / divisor);
  return (units * rate).toFixed(2);
}

export default function EditShipmentModal({ orderId, weight, shippingCost, shippingRate, shippingUnit }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState(String(weight));
  const [shippingCostInput, setShippingCostInput] = useState(String(shippingCost));
  const [auto, setAuto] = useState(false);

  function openModal() {
    setWeightInput(String(weight));
    setShippingCostInput(String(shippingCost));
    setAuto(false);
    setError(null);
    setOpen(true);
  }

  function handleWeightChange(value: string) {
    setWeightInput(value);
    if (auto) setShippingCostInput(calcAutoShipping(value, shippingRate, shippingUnit));
  }

  function resetAuto() {
    setAuto(true);
    setShippingCostInput(calcAutoShipping(weightInput, shippingRate, shippingUnit));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await updateOrderShipment(orderId, parseFloat(weightInput) || 0, parseFloat(shippingCostInput) || 0);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el envío');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.9rem' }} title="Editar peso y envío" onClick={openModal}>
        ✏️
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Editar Peso y Costo de Envío">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-container">
              <label>⚖️ Peso Total (lbs)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={weightInput}
                onChange={(e) => handleWeightChange(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="input-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>🚚 Costo de Envío ($)</label>
                {!auto && shippingRate > 0 && (
                  <button
                    type="button"
                    onClick={resetAuto}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, padding: 0 }}
                  >
                    ↺ Auto
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={shippingCostInput}
                onChange={(e) => {
                  setAuto(false);
                  setShippingCostInput(e.target.value);
                }}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
