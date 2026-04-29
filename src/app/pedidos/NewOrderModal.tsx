'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { createOrder } from '../actions/orders';

interface NewOrderModalProps {
  clients: { id: string; name: string; code: string }[];
  initialClientId?: string;
}

const EMPTY_PRODUCT = () => ({
  id: Date.now() + Math.random(),
  name: '', weight: '', purchasedBy: 'CLIENT',
  purchaseValue: '', prepaidAmount: '', shippingCost: ''
});

export default function NewOrderModal({ clients, initialClientId }: NewOrderModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(initialClientId || '');
  const [products, setProducts] = useState([EMPTY_PRODUCT()]);

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  const addProduct = () => setProducts(prev => [...prev, EMPTY_PRODUCT()]);

  const removeProduct = (id: number) => {
    if (products.length > 1) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateProduct = (id: number, field: string, value: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Live total calculation
  const totalAmount = products.reduce((sum, p) => {
    const shipping = parseFloat(p.shippingCost) || 0;
    const purchase = p.purchasedBy === 'SHOPUSA' ? (parseFloat(p.purchaseValue) || 0) : 0;
    return sum + shipping + purchase;
  }, 0);
  const totalPrepaid = products.reduce((sum, p) => sum + (parseFloat(p.prepaidAmount) || 0), 0);
  const balance = totalAmount - totalPrepaid;

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

          <div className="input-container" style={{ marginBottom: '24px' }}>
            <label>Seleccionar Cliente</label>
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={!!initialClientId}>
              <option value="">-- Seleccione un cliente --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
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
                    <button type="button" onClick={() => removeProduct(product.id as number)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      ✕ Eliminar
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-container" style={{ gridColumn: 'span 2' }}>
                    <label>Nombre del Producto</label>
                    <input type="text" className="input-field" value={product.name} onChange={(e) => updateProduct(product.id as number, 'name', e.target.value)} placeholder="Ej: Laptop, Zapatos, Perfume..." required />
                  </div>

                  <div className="input-container">
                    <label>⚖️ Peso (lbs)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={product.weight} onChange={(e) => updateProduct(product.id as number, 'weight', e.target.value)} placeholder="0.00" required />
                  </div>

                  <div className="input-container">
                    <label>Comprado por</label>
                    <select className="input-field" value={product.purchasedBy} onChange={(e) => updateProduct(product.id as number, 'purchasedBy', e.target.value)}>
                      <option value="CLIENT">👤 Cliente</option>
                      <option value="SHOPUSA">🏪 ShopUSA</option>
                    </select>
                  </div>

                  {product.purchasedBy === 'SHOPUSA' && (
                    <div className="input-container">
                      <label>💵 Valor de Compra ($)</label>
                      <input type="number" step="0.01" min="0" className="input-field" value={product.purchaseValue} onChange={(e) => updateProduct(product.id as number, 'purchaseValue', e.target.value)} placeholder="0.00" required />
                    </div>
                  )}

                  <div className="input-container">
                    <label>🚚 Costo de Envío ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={product.shippingCost} onChange={(e) => updateProduct(product.id as number, 'shippingCost', e.target.value)} placeholder="0.00" />
                  </div>

                  <div className="input-container">
                    <label>✅ Abono / Prepago ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={product.prepaidAmount} onChange={(e) => updateProduct(product.id as number, 'prepaidAmount', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>
            ))}

            {/* Live running total */}
            <div style={{ display: 'flex', gap: '24px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pedido</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>${totalAmount.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Abonado</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>${totalPrepaid.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance Pendiente</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: balance > 0 ? '#ef4444' : '#10b981' }}>${balance.toFixed(2)}</div>
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
