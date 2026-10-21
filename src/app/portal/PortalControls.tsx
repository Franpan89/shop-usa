'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ImageUploader from '@/components/ui/ImageUploader';
import CopyButton from '@/components/ui/CopyButton';
import { toast } from '@/components/ui/Toast';
import { portalSetDecision, portalSubmitTransfer } from '@/app/actions/portal';
import { confirmCardCheckout, createCardCheckout } from '@/app/actions/cardPayments';

/** Retener / Despachar: por defecto se despacha; solo hay que actuar para retener (3.10). */
export function PortalDecision({ consolidationId, decision, locked }: { consolidationId: string; decision: 'DISPATCH' | 'HOLD'; locked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: 'DISPATCH' | 'HOLD') {
    startTransition(async () => {
      const res = await portalSetDecision(consolidationId, next);
      if (!res.ok) return toast(res.error, 'error');
      toast(next === 'HOLD' ? 'Listo: retendremos tu mercancía' : 'Listo: tu mercancía irá en el próximo despacho', 'success');
      router.refresh();
    });
  }

  return (
    <div className="decision-actions">
      <button className={decision === 'DISPATCH' ? 'btn' : 'btn btn-secondary'} disabled={pending || locked} onClick={() => choose('DISPATCH')}>
        🚚 Despachar
      </button>
      <button className={decision === 'HOLD' ? 'btn' : 'btn btn-secondary'} disabled={pending || locked} onClick={() => choose('HOLD')}>
        ⏳ Retener mercadería
      </button>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

type PayInvoice = { id: string; label: string; balance: number };

/** "¿Qué estás pagando?": todo el saldo o una factura concreta. Avisa el monto sugerido al cambiar. */
function InvoicePicker({ invoices, value, onChange }: { invoices: PayInvoice[]; value: string; onChange: (id: string, balance: number | null) => void }) {
  if (invoices.length === 0) return null;
  return (
    <div className="input-container">
      <label>¿Qué estás pagando?</label>
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value, invoices.find((i) => i.id === e.target.value)?.balance ?? null)}>
        <option value="">Todo mi saldo</option>
        {invoices.map((i) => (
          <option key={i.id} value={i.id}>{i.label} · ${i.balance.toFixed(2)}</option>
        ))}
      </select>
    </div>
  );
}

/** PAGO CON TRANSFERENCIA: primero los datos de la cuenta, después el comprobante (queda por verificar, 2.8). */
export function TransferButton({
  invoices,
  defaultInvoiceId,
  defaultAmount,
  instructions,
  label = '🏦 Pagar con transferencia',
  className = 'btn btn-secondary',
}: {
  invoices: PayInvoice[];
  defaultInvoiceId?: string;
  defaultAmount?: number;
  instructions?: string | null;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState(defaultInvoiceId ?? '');
  const [amount, setAmount] = useState(defaultAmount ? defaultAmount.toFixed(2) : '');
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Pagar con transferencia">
        <div className="stack">
          <div className="pay-step">
            <div className="pay-step-title"><span className="pay-step-n">1</span> Transfiere a esta cuenta</div>
            {instructions ? (
              <>
                <div className="bank-box">{instructions}</div>
                <CopyButton text={instructions} className="btn btn-ghost btn-sm">📋 Copiar datos de la cuenta</CopyButton>
              </>
            ) : (
              <p className="muted small">Escríbenos por WhatsApp y te enviamos los datos de la cuenta.</p>
            )}
          </div>

          <div className="pay-step">
            <div className="pay-step-title"><span className="pay-step-n">2</span> Sube tu comprobante</div>
            <div className="stack">
              <InvoicePicker invoices={invoices} value={invoiceId} onChange={(id, bal) => { setInvoiceId(id); if (bal != null) setAmount(bal.toFixed(2)); }} />
              <div className="form-grid">
                <div className="input-container"><label>Monto transferido ($) *</label><input type="number" inputMode="decimal" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div className="input-container"><label>Fecha</label><input type="date" className="input-field" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
                <div className="input-container span-2"><label>N.º de transferencia (opcional)</label><input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              </div>
              <ImageUploader kind="proof" allowPdf required label="Comprobante" value={proof} onChange={setProof} />
              <p className="muted small">Verificaremos que el dinero esté en nuestra cuenta antes de aprobar tu pago. Te avisamos por correo.</p>
            </div>
          </div>

          <div className="sheet-actions">
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !proof || !(parseFloat(amount) > 0)}
              onClick={() =>
                startTransition(async () => {
                  const res = await portalSubmitTransfer({ amount: parseFloat(amount), paidAt, reference, proofPath: proof!, targetInvoiceId: invoiceId || null });
                  if (!res.ok) return toast(res.error, 'error');
                  toast('Recibimos tu comprobante: queda por verificar', 'success');
                  setOpen(false);
                  setProof(null);
                  router.refresh();
                })
              }
            >
              {pending ? '⏳ Enviando…' : 'Enviar comprobante'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** PAGO CON TARJETA: se crea el enlace y se abre Square; el cliente paga allá y vuelve a su estado de cuenta. */
export function CardPayButton({
  invoices,
  defaultInvoiceId,
  pendingTotal,
  label = '💳 Pagar con tarjeta',
  className = 'btn',
}: {
  invoices: PayInvoice[];
  defaultInvoiceId?: string;
  pendingTotal: number;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState(defaultInvoiceId ?? '');
  const [amount, setAmount] = useState(pendingTotal > 0 ? pendingTotal.toFixed(2) : '');
  const [pending, startTransition] = useTransition();
  const max = invoiceId ? invoices.find((i) => i.id === invoiceId)?.balance ?? pendingTotal : pendingTotal;
  const value = parseFloat(amount);
  const valid = value >= 1 && value <= max + 0.004;

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} disabled={pendingTotal < 1} title={pendingTotal < 1 ? 'No tienes saldo pendiente' : undefined}>{label}</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Pagar con tarjeta">
        <div className="stack">
          <InvoicePicker invoices={invoices} value={invoiceId} onChange={(id, bal) => { setInvoiceId(id); setAmount((bal ?? pendingTotal).toFixed(2)); }} />
          <div className="input-container">
            <label>Monto a pagar ($)</label>
            <input type="number" inputMode="decimal" step="0.01" min="1" max={max.toFixed(2)} className="input-field pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="input-hint">Puedes pagar todo o una parte. Máximo ${max.toFixed(2)}.</span>
          </div>
          <p className="muted small">🔒 Pagas en la página segura de Square. ShopUSA no ve ni guarda los datos de tu tarjeta. Tu pago se aplica a tu cuenta automáticamente.</p>
          <div className="sheet-actions">
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !valid}
              onClick={() =>
                startTransition(async () => {
                  const res = await createCardCheckout({ amount: value, targetInvoiceId: invoiceId || null });
                  if (!res.ok) return toast(res.error, 'error');
                  window.location.assign(res.url);
                })
              }
            >
              {pending ? '⏳ Abriendo Square…' : `Pagar ${valid ? `$${value.toFixed(2)}` : ''}`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Los dos botones de pago. La tarjeta solo aparece si Square está configurado. */
export function PayActions({
  invoices,
  defaultInvoiceId,
  pendingTotal,
  instructions,
  cardEnabled,
}: {
  invoices: PayInvoice[];
  defaultInvoiceId?: string;
  pendingTotal: number;
  instructions?: string | null;
  cardEnabled: boolean;
}) {
  return (
    <div className="pay-actions">
      {cardEnabled && <CardPayButton invoices={invoices} defaultInvoiceId={defaultInvoiceId} pendingTotal={pendingTotal} />}
      <TransferButton
        invoices={invoices}
        defaultInvoiceId={defaultInvoiceId}
        defaultAmount={pendingTotal > 0 ? pendingTotal : undefined}
        instructions={instructions}
        className={cardEnabled ? 'btn btn-secondary' : 'btn'}
      />
    </div>
  );
}

/** Aviso al volver de Square: confirma el cobro (sin esperar al webhook) y muestra el resultado. */
export function CardReturn({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'paid' | 'waiting' | 'failed'>('checking');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let tries = 0;
    const check = async () => {
      const res = await confirmCardCheckout(checkoutId);
      const outcome = res.ok ? res.outcome : 'FAILED';
      if (outcome === 'PAID') {
        setState('paid');
        router.refresh();
      } else if (outcome === 'FAILED' || outcome === 'NOT_FOUND') {
        setState('failed');
      } else if (++tries < 6) {
        setState('checking');
        setTimeout(check, 3000);
      } else {
        setState('waiting');
      }
    };
    void check();
  }, [checkoutId, router]);

  const tone = state === 'paid' ? 'success' : state === 'failed' ? 'danger' : 'info';
  return (
    <div className={`alert alert-${tone}`} role="status">
      <span>{state === 'paid' ? '✅' : state === 'failed' ? '⚠️' : '⏳'}</span>
      <div className="grow">
        {state === 'checking' && 'Confirmando tu pago con Square…'}
        {state === 'paid' && (
          <>
            <strong>¡Pago recibido!</strong> Ya lo aplicamos a tu cuenta.
          </>
        )}
        {state === 'waiting' && 'Square todavía está procesando tu pago. En unos minutos se reflejará solo en tu estado de cuenta; te avisaremos por correo.'}
        {state === 'failed' && 'No pudimos confirmar el pago. Si no se te cobró, intenta de nuevo; si se te cobró, escríbenos por WhatsApp.'}
      </div>
    </div>
  );
}
