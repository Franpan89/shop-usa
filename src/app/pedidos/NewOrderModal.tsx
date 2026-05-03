'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { createOrder } from '../actions/orders';

interface Client {
  id: string;
  name: string;
  code: string;
  serviceFeePercent: number;
  country: string;
  shippingRatePerHalfLb: number | null;
}

interface NewOrderModalProps {
  clients: Client[];
  shippingRates: Record<string, number>;
  initialClientId?: string;
}

type Product = {
  id: number;
  name: string;
  weight: string;
  purchasedBy: string;
  purchaseValue: string;
  prepaidAmount: string;
  shippingCost: string;
  shippingAuto: boolean;
};

const EMPTY_PRODUCT = (): Product => ({
  id: Date.now() + Math.random(),
  name: '', weight: '', purchasedBy: 'CLIENT',
  purchaseValue: '', prepaidAmount: '', shippingCost: '',
  shippingAuto: true,
});

function calcAutoShipping(weight: string, rate: number): string {
  const w = parseFloat(weight);
  if (!w || w <= 0 || !rate) return '';
  const halfPounds = Math.ceil(w / 0.5);
  return (halfPounds * rate).toFixed(2);
}

export default function NewOrderModal({ clients, shippingRates, initialClientId }: NewOrderModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(initialClientId || '');
  const [products, setProducts] = useState<Product[]>([EMPTY_PRODUCT()]);

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  const selectedClient = clients.find(c => c.id === clientId);
  const shippingRate = selectedClient?.shippingRatePerHalfLb ?? (selectedClient?.country ? shippingRates[selectedClient.country] : 0) ?? 0;

  // Recompute auto-shipping costs when client changes
  useEffect(() => {
    const client = clients.find(c => c.id === clientId);
    const rate = client?.shippingRatePerHalfLb ?? (client?.country ? shippingRates[client.country] : 0) ?? 0;
    setProducts(prev => prev.map(p => {
      if (!p.shippingAuto) return p;
      return { ...p, shippingCost: calcAutoShipping(p.weight, rate) };
    }));
  }, [clientId]);

  const addProduct = () => setProducts(prev => [...prev, EMPTY_PRODUCT()]);

  const removeProduct = (id: number) => {
    if (products.length > 1) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateProduct = (id: number, field: string, value: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated: Product = { ...p, [field]: value };
      if (field === 'weight' && p.shippingAuto) {
        updated.shippingCost = calcAutoShipping(value, shippingRate);
      }
      if (field === 'shippingCost') {
        updated.shippingAuto = false;
      }
      return updated;
    }));
  };

  const resetShippingAuto = (id: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, shippingAuto: true, shippingCost: calcAutoShipping(p.weight, shippingRate) };
    }));
  };

  // Live totals
  const TAX_RATE = 0.065;
  const feePercent = selectedClient?.serviceFeePercent ?? 20;
  const baseAmount = products.reduce((sum, p) => {
    const shipping = parseFloat(p.shippingCost) || 0;
    const purchase = p.purchasedBy === 'SHOPUSA' ? (parseFloat(p.purchaseValue) || 0) : 0;
    return sum + shipping + purchase;
  }, 0);
  const taxAmount = products.reduce((sum, p) => {
    if (p.purchasedBy !== 'SHOPUSA') return sum;
    return sum + (parseFloat(p.purchaseValue) || 0) * TAX_RATE;
  }, 0);
  const baseWithTax = baseAmount + taxAmount;
  const serviceFee = baseWithTax * feePercent / 100;
  const totalAmount = baseWithTax + serviceFee;
  const totalPrepaid = products.reduce((sum, p) => sum + (parseFloat(p.prepaidAmount) || 0), 0);
  const balance = totalAmount - totalPrepaid;
  const hasShopusaItems = products.some(p => p.purchasedBy === 'SHOPUSA');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId) { setError('Debe seleccionar un cliente'); return; }
    setIsPending(true);
    setError(null);
    try {
      await createOrder(clientId, products);
      setIsOpen(false);
      setProducts([EMPTY_PRODUCT()]);
      setClientId(initialClientId || '');
    } catch (err: any) {
      setError(err.message || 'Error al crear pedido');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>
        + Nuevo Pedido
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Crear Nuevo Envío / Pedido">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'flex-end' }}>
            <div className="input-container" style={{ flex: 1, margin: 0 }}>
              <label>Seleccionar Cliente</label>
              <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={!!initialClientId}>
                <option value="">-- Seleccione un cliente --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            {selectedClient && (
              <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Tarifa envío</div>
                <strong style={{ color: 'var(--accent-color)' }}>
                  {shippingRate ? `$${shippingRate.toFixed(2)}/0.5 lbs` : 'Sin tarifa'}
                  {selectedClient.shippingRatePerHalfLb ? ' ★ personal' : ` (${selectedClient.country})`}
                </strong>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Productos / Ítems</h3>
              <button type="button" className="btn btn-secondary" onClick={addProduct} style={{ padding: '6px 14px', fontSize: '0.9rem' }}>
                + Agregar Ítem
              </button>
            </div>

            {products.map((product, index) => (
              <div key={product.id} style={{ padding: '16px', marginBottom: '16px', borderRadius: '12px', background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.95rem' }}>📦 Ítem #{index + 1}</span>
                  {products.length > 1 && (
                    <button type="button" onClick={() => removeProduct(product.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      ✕ Eliminar
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-container" style={{ gridColumn: 'span 2' }}>
                    <label>Nombre del Producto</label>
                    <input type="text" className="input-field" value={product.name} onChange={(e) => updateProduct(product.id, 'name', e.target.value)} placeholder="Ej: Laptop, Zapatos, Perfume..." required />
                  </div>

                  <div className="input-container">
                    <label>⚖️ Peso (lbs)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={product.weight} onChange={(e) => updateProduct(product.id, 'weight', e.target.value)} placeholder="0.00" required />
                  </div>

                  <div className="input-container">
                    <label>Comprado por</label>
                    <select className="input-field" value={product.purchasedBy} onChange={(e) => updateProduct(product.id, 'purchasedBy', e.target.value)}>
                      <option value="CLIENT">👤 Cliente</option>
                      <option value="SHOPUSA">🏪 ShopUSA</option>
                    </select>
                  </div>

                  {product.purchasedBy === 'SHOPUSA' && (
                    <div className="input-container">
                      <label>💵 Valor de Compra ($)</label>
                      <input type="number" step="0.01" min="0" className="input-field" value={product.purchaseValue} onChange={(e) => updateProduct(product.id, 'purchaseValue', e.target.value)} placeholder="0.00" required />
                    </div>
                  )}

                  <div className="input-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0 }}>🚚 Costo de Envío ($)</label>
                      {!product.shippingAuto && shippingRate > 0 && (
                        <button
                          type="button"
                          onClick={() => resetShippingAuto(product.id)}
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
                      value={product.shippingCost}
                      onChange={(e) => updateProduct(product.id, 'shippingCost', e.target.value)}
                      placeholder={shippingRate > 0 ? 'Auto-calculado' : '0.00'}
                      style={product.shippingAuto && product.shippingCost ? { borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.04)' } : {}}
                    />
                    {product.shippingAuto && product.shippingCost && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-color)', marginTop: '4px' }}>
                        ✦ Auto: {Math.ceil((parseFloat(product.weight) || 0) / 0.5)} tramos × ${shippingRate.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="input-container">
                    <label>✅ Abono / Prepago ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={product.prepaidAmount} onChange={(e) => updateProduct(product.id, 'prepaidAmount', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>
            ))}

            {/* Live totals bar */}
            <div style={{ borderRadius: '12px', background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtotal</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>${baseAmount.toFixed(2)}</div>
                </div>
                {hasShopusaItems && (
                  <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(128,128,128,0.1)', background: 'rgba(239,68,68,0.04)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impuesto (6.5%)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ef4444' }}>${taxAmount.toFixed(2)}</div>
                  </div>
                )}
                <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fee ({feePercent}%)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b' }}>${serviceFee.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>${totalAmount.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Abonado</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>${totalPrepaid.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: balance > 0 ? '#ef4444' : '#10b981' }}>${balance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? '⏳ Guardando...' : '🚀 Crear Envío'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
