'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ClientPicker, { type PickableClient } from '@/components/ui/ClientPicker';
import ImageUploader from '@/components/ui/ImageUploader';
import { toast } from '@/components/ui/Toast';
import { computePurchase, effectiveServiceRate } from '@/lib/domain/pricing';
import { createOrder, updateOrder, type OrderItemInput } from '@/app/actions/orders';

export interface OrderFormClient extends PickableClient {
  serviceFeePercent: number;
  shippingCategoryName: string | null;
  availableBenefits: number;
}

export interface OrderFormInitial {
  orderId: string;
  clientId: string;
  type: 'PERSONAL_SHOPPER' | 'CART';
  /** tasa con la que se generó el pedido (conserva el beneficio de referido, si lo usó) */
  serviceRate: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    storeName: string;
    url: string;
    variant: string;
    notes: string;
    imageUrl: string;
  }[];
  discount: { type: 'AMOUNT' | 'PERCENT'; value: number; reason: string } | null;
  extraCharges: number;
  extraChargesNote: string;
  notes: string;
  channel: string;
}

interface Props {
  clients: OrderFormClient[];
  catalog: { name: string; price: number | null }[];
  settings: { taxRatePercent: number; cartServiceRatePercent: number; referralDiscountPoints: number };
  initialClientId?: string;
  initial?: OrderFormInitial;
}

interface ItemState {
  key: number;
  name: string;
  quantity: string;
  unitPrice: string;
  storeName: string;
  url: string;
  variant: string;
  notes: string;
  imageUrl: string;
  details: boolean;
}

const DISCOUNT_REASONS = ['Promoción', 'Cliente frecuente', 'Referido', 'Cortesía', 'Ajuste', 'Otro'];
const CHANNELS = ['Web', 'WhatsApp', 'Instagram', 'Otro'];
let keySeq = 1;
const emptyItem = (): ItemState => ({ key: keySeq++, name: '', quantity: '1', unitPrice: '', storeName: '', url: '', variant: '', notes: '', imageUrl: '', details: false });

const money = (n: number) => `$${n.toFixed(2)}`;

export default function OrderForm({ clients, catalog, settings, initialClientId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!initial;

  const [type, setType] = useState<'PERSONAL_SHOPPER' | 'CART'>(initial?.type ?? 'PERSONAL_SHOPPER');
  const [clientId, setClientId] = useState(initial?.clientId ?? initialClientId ?? '');
  const [items, setItems] = useState<ItemState[]>(
    initial
      ? initial.items.map((i) => ({ key: keySeq++, name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice), storeName: i.storeName, url: i.url, variant: i.variant, notes: i.notes, imageUrl: i.imageUrl, details: !!(i.storeName || i.url || i.variant || i.notes) }))
      : [emptyItem()],
  );
  const [discountOn, setDiscountOn] = useState(!!initial?.discount);
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>(initial?.discount?.type ?? 'AMOUNT');
  const [discountValue, setDiscountValue] = useState(initial?.discount ? String(initial.discount.value) : '');
  const [discountReason, setDiscountReason] = useState(initial?.discount?.reason ?? 'Promoción');
  const [extra, setExtra] = useState(initial?.extraCharges ? String(initial.extraCharges) : '');
  const [extraNote, setExtraNote] = useState(initial?.extraChargesNote ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [channel, setChannel] = useState(initial?.channel ?? 'WhatsApp');

  const client = clients.find((c) => c.id === clientId);
  const catalogByName = useMemo(() => new Map(catalog.map((c) => [c.name.toLowerCase(), c])), [catalog]);

  // Tasa: Personal Shopper usa la del cliente (menos el beneficio de referido, si tiene); Carrito usa la configurada.
  const { rate, benefitApplied, baseRate } = useMemo(() => {
    if (isEdit) return { rate: initial!.serviceRate, benefitApplied: false, baseRate: initial!.serviceRate };
    if (type === 'CART') return { rate: settings.cartServiceRatePercent, benefitApplied: false, baseRate: settings.cartServiceRatePercent };
    const base = client?.serviceFeePercent ?? 20;
    const r = effectiveServiceRate(base, client?.availableBenefits ?? 0, settings.referralDiscountPoints);
    return { rate: r.rate, benefitApplied: r.benefitApplied, baseRate: base };
  }, [isEdit, initial, type, client, settings]);

  const totals = useMemo(
    () =>
      computePurchase({
        lines: items.map((i) => ({ unitPrice: parseFloat(i.unitPrice) || 0, quantity: parseInt(i.quantity, 10) || 0 })),
        taxRatePercent: settings.taxRatePercent,
        serviceRatePercent: rate,
        extraCharges: type === 'CART' ? parseFloat(extra) || 0 : 0,
        discount: discountOn && parseFloat(discountValue) > 0 ? { type: discountType, value: parseFloat(discountValue) } : null,
      }),
    [items, settings.taxRatePercent, rate, type, extra, discountOn, discountType, discountValue],
  );

  function updateItem(key: number, patch: Partial<ItemState>) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const next = { ...i, ...patch };
        if (patch.name !== undefined) {
          const match = catalogByName.get(patch.name.trim().toLowerCase());
          if (match?.price != null && !i.unitPrice) next.unitPrice = String(match.price);
        }
        return next;
      }),
    );
  }

  function submit() {
    if (!clientId) return toast('Selecciona un cliente', 'error');
    const payloadItems: OrderItemInput[] = items.map((i) => ({
      name: i.name,
      quantity: parseInt(i.quantity, 10),
      unitPrice: parseFloat(i.unitPrice),
      storeName: i.storeName,
      url: i.url,
      variant: i.variant,
      notes: i.notes,
      imageUrl: i.imageUrl,
    }));
    const discount = discountOn && parseFloat(discountValue) > 0 ? { type: discountType, value: parseFloat(discountValue), reason: discountReason } : null;
    const extraCharges = type === 'CART' ? parseFloat(extra) || 0 : 0;

    startTransition(async () => {
      if (isEdit) {
        const res = await updateOrder(initial!.orderId, { items: payloadItems, discount, extraCharges, extraChargesNote: extraNote, notes, channel });
        if (!res.ok) return toast(res.error, 'error');
        toast('Pedido actualizado', 'success');
        router.push(`/pedidos/${initial!.orderId}`);
        return;
      }
      const res = await createOrder({ clientId, type, items: payloadItems, discount, extraCharges, extraChargesNote: extraNote, notes, channel });
      if (!res.ok) return toast(res.error, 'error');
      toast('Pedido creado — queda pendiente de pago', 'success');
      router.push(`/pedidos/${res.orderId}`);
    });
  }

  return (
    <div className="page-grid">
      <div className="stack">
        {!isEdit && (
          <div className="glass-panel static panel">
            <div className="row" style={{ gap: 10 }}>
              {([
                ['PERSONAL_SHOPPER', '🛍️ Personal Shopper', 'Shop USA busca y compra los productos'],
                ['CART', '🛒 Compramos tu carrito', 'El cliente ya eligió; Shop USA paga por él'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={type === value ? 'btn' : 'btn btn-secondary'}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '12px 18px', textAlign: 'left' }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 500, opacity: 0.85 }}>{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass-panel static panel">
          <div className="stack">
            <ClientPicker clients={clients} value={clientId} onChange={setClientId} disabled={isEdit} autoFocus={!initialClientId && !isEdit} />
            {client && (
              <div className="row" style={{ gap: 8 }}>
                <span className="badge badge-secondary">{client.country}</span>
                <span className="badge badge-secondary">Envío: {client.shippingCategoryName ?? 'sin tarifa'}</span>
                <span className="badge badge-accent">Servicio {baseRate}%</span>
                {benefitApplied && <span className="badge badge-success">🎁 Beneficio de referido: {rate}% en esta factura</span>}
                {!isEdit && type === 'PERSONAL_SHOPPER' && (client.availableBenefits ?? 0) > 1 && (
                  <span className="muted small">Quedarán {client.availableBenefits - 1} beneficio(s) para sus próximas facturas.</span>
                )}
              </div>
            )}
            <p className="muted small">En esta etapa no se cobra el envío: la tarifa queda asociada al cliente y se calcula cuando se pese su mercancía.</p>
          </div>
        </div>

        <div className="glass-panel static panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Productos</h2>
              <p className="panel-sub">Cada producto conserva su identidad individual hasta la entrega.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, emptyItem()])}>+ Agregar producto</button>
          </div>

          <datalist id="catalog-products">
            {catalog.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>

          <div className="stack">
            {items.map((item, idx) => (
              <div key={item.key} className="group-card" style={{ padding: 16 }}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <strong className="muted small">PRODUCTO #{idx + 1}</strong>
                  {items.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}>Quitar</button>
                  )}
                </div>
                <div className="form-grid">
                  <div className="input-container span-2">
                    <label>Descripción *</label>
                    <input className="input-field" list="catalog-products" value={item.name} onChange={(e) => updateItem(item.key, { name: e.target.value })} placeholder="Zapatos Nike Air Max blancos talla 8" />
                  </div>
                  <div className="input-container">
                    <label>Precio en tienda ($) *</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={item.unitPrice} onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })} />
                  </div>
                  <div className="input-container">
                    <label>Cantidad *</label>
                    <input type="number" min="1" step="1" className="input-field" value={item.quantity} onChange={(e) => updateItem(item.key, { quantity: e.target.value })} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <ImageUploader kind="product" compact value={item.imageUrl} onChange={(v) => updateItem(item.key, { imageUrl: v ?? '' })} label="Foto (si ya la tienes)" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateItem(item.key, { details: !item.details })} style={{ marginLeft: 'auto' }}>
                    {item.details || type === 'CART' ? '▾' : '▸'} Tienda, link, variantes, notas
                  </button>
                </div>
                {(item.details || type === 'CART') && (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <div className="input-container"><label>Tienda</label><input className="input-field" value={item.storeName} onChange={(e) => updateItem(item.key, { storeName: e.target.value })} placeholder="Amazon, Nike…" /></div>
                    <div className="input-container"><label>Link del producto o carrito</label><input className="input-field" value={item.url} onChange={(e) => updateItem(item.key, { url: e.target.value })} placeholder="https://…" /></div>
                    <div className="input-container"><label>Variante (talla, color, modelo)</label><input className="input-field" value={item.variant} onChange={(e) => updateItem(item.key, { variant: e.target.value })} /></div>
                    <div className="input-container"><label>Notas</label><input className="input-field" value={item.notes} onChange={(e) => updateItem(item.key, { notes: e.target.value })} /></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {type === 'CART' && (
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="input-container">
                <label>Otros costos de la compra ($)</label>
                <input type="number" step="0.01" min="0" className="input-field" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Shipping cobrado por la tienda" />
                <span className="input-hint">Se suma al total sin tax ni tasa de servicio.</span>
              </div>
              <div className="input-container"><label>Concepto</label><input className="input-field" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} placeholder="Shipping de la tienda" /></div>
            </div>
          )}
        </div>

        <div className="glass-panel static panel">
          <label className="check" style={{ marginBottom: discountOn ? 14 : 0 }}>
            <input type="checkbox" checked={discountOn} onChange={(e) => setDiscountOn(e.target.checked)} />
            <strong>Aplicar descuento</strong> <span className="muted small">(opcional — queda registrado con su motivo)</span>
          </label>
          {discountOn && (
            <div className="form-grid">
              <div className="input-container">
                <label>Tipo</label>
                <select className="input-field" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'AMOUNT' | 'PERCENT')}>
                  <option value="AMOUNT">Dólares ($)</option>
                  <option value="PERCENT">Porcentaje (%)</option>
                </select>
              </div>
              <div className="input-container">
                <label>Valor</label>
                <input type="number" step="0.01" min="0" className="input-field" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
              </div>
              <div className="input-container">
                <label>Motivo</label>
                <select className="input-field" value={DISCOUNT_REASONS.includes(discountReason) ? discountReason : 'Otro'} onChange={(e) => setDiscountReason(e.target.value)}>
                  {DISCOUNT_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel static panel">
          <div className="form-grid">
            <div className="input-container">
              <label>Canal</label>
              <select className="input-field" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="input-container span-2"><label>Notas internas</label><input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        </div>
      </div>

      <aside className="glass-panel static panel" style={{ position: 'sticky', top: 0 }}>
        <h2 className="panel-title" style={{ marginBottom: 14 }}>Resumen para el cliente</h2>
        <dl className="summary">
          {items.filter((i) => i.name.trim()).map((i) => (
            <div key={i.key} style={{ display: 'contents' }}>
              <dt>{i.name}{parseInt(i.quantity, 10) > 1 ? ` (x${i.quantity})` : ''}</dt>
              <dd>{money((parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity, 10) || 0))}</dd>
            </div>
          ))}
          <dt className="strong">Subtotal</dt><dd>{money(totals.subtotal)}</dd>
          <dt>Tax {settings.taxRatePercent}%</dt><dd>{money(totals.tax)}</dd>
          <dt className="strong">Total factura</dt><dd>{money(totals.invoiceTotal)}</dd>
          <dt>Servicio {type === 'CART' ? 'Carrito' : 'Personal Shopper'} {rate}%</dt><dd>{money(totals.serviceFee)}</dd>
          {totals.extraCharges > 0 && (<><dt>{extraNote || 'Otros costos'}</dt><dd>{money(totals.extraCharges)}</dd></>)}
          <dt>Descuento</dt><dd>{totals.discountAmount > 0 ? `-${money(totals.discountAmount)}` : '$0.00'}</dd>
          <dt className="total-label">TOTAL A PAGAR</dt><dd className="total">{money(totals.total)}</dd>
        </dl>
        <p className="muted small" style={{ margin: '14px 0' }}>
          Shop USA no adelanta dinero: el pedido queda <strong>pendiente de pago</strong> y solo se compra cuando el pago esté aprobado.
        </p>
        <button className="btn" style={{ width: '100%' }} disabled={pending || !clientId} onClick={submit}>
          {pending ? '⏳ Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pedido'}
        </button>
      </aside>
    </div>
  );
}
