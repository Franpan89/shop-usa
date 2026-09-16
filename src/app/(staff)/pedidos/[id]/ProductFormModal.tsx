'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { addProductToOrder, updateProduct, type ProductFormInput } from '../../../actions/orders';

interface CatalogEntry {
  name: string;
  defaultPurchaseValue: number | null;
  defaultPurchasedBy: string;
}

interface ExistingProduct {
  id: string;
  name: string;
  purchasedBy: string;
  purchaseValue: number | null;
  prepaidAmount: number;
}

interface ProductFormModalProps {
  orderId: string;
  catalog?: CatalogEntry[];
  product?: ExistingProduct;
}

const emptyForm = (product?: ExistingProduct) => ({
  name: product?.name ?? '',
  purchasedBy: product?.purchasedBy ?? 'CLIENT',
  purchaseValue: product?.purchaseValue != null ? String(product.purchaseValue) : '',
  prepaidAmount: product ? String(product.prepaidAmount) : '',
});

export default function ProductFormModal({ orderId, catalog = [], product }: ProductFormModalProps) {
  const isEdit = !!product;
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm(product));

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'name' && !isEdit) {
        const match = catalog.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
        if (match) {
          if (!prev.purchaseValue && match.defaultPurchaseValue != null) {
            next.purchaseValue = String(match.defaultPurchaseValue);
          }
          next.purchasedBy = match.defaultPurchasedBy;
        }
      }

      return next;
    });
  }

  function resetForm() {
    setForm(emptyForm(product));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const input: ProductFormInput = {
        name: form.name,
        purchasedBy: form.purchasedBy as 'CLIENT' | 'SHOPUSA',
        purchaseValue: form.purchaseValue ? parseFloat(form.purchaseValue) : null,
        prepaidAmount: parseFloat(form.prepaidAmount) || 0,
      };
      if (isEdit) {
        await updateProduct(product.id, input);
      } else {
        await addProductToOrder(orderId, input);
      }
      setIsOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar producto');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.9rem' }}
          title="Editar producto"
          onClick={() => setIsOpen(true)}
        >
          ✏️
        </button>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(true)}>
          + Agregar producto
        </button>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={isEdit ? 'Editar Producto' : 'Agregar Producto'}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>
                Nombre del Producto
                {catalog.length > 0 && !isEdit && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 400 }}>
                    (autocompleta con el catálogo)
                  </span>
                )}
              </label>
              <input
                type="text"
                className="input-field"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Ej: Laptop, Zapatos, Perfume..."
                required
                list="edit-product-catalog"
              />
              {catalog.length > 0 && (
                <datalist id="edit-product-catalog">
                  {catalog.map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="input-container">
              <label>Comprado por</label>
              <select className="input-field" value={form.purchasedBy} onChange={(e) => update('purchasedBy', e.target.value)}>
                <option value="CLIENT">👤 Cliente</option>
                <option value="SHOPUSA">🏪 ShopUSA</option>
              </select>
            </div>

            {form.purchasedBy === 'SHOPUSA' && (
              <div className="input-container">
                <label>💵 Valor de Compra ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  value={form.purchaseValue}
                  onChange={(e) => update('purchaseValue', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            <div className="input-container">
              <label>✅ Abono / Prepago ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={form.prepaidAmount}
                onChange={(e) => update('prepaidAmount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
