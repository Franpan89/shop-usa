'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ImageUploader from '@/components/ui/ImageUploader';
import { toast } from '@/components/ui/Toast';
import { portalSetDecision, portalSubmitTransfer } from '@/app/actions/portal';

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
    <div className="row" style={{ gap: 10 }}>
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

/** "YA REALICÉ MI TRANSFERENCIA": declara el pago y sube el comprobante; queda por verificar (2.8). */
export function TransferButton({
  invoices,
  defaultInvoiceId,
  defaultAmount,
  instructions,
  label = '💳 Ya realicé mi transferencia',
  className = 'btn',
}: {
  invoices: { id: string; label: string; balance: number }[];
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
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Registrar mi transferencia">
        <div className="stack">
          {instructions && (
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <span>🏦</span>
              <div style={{ whiteSpace: 'pre-line' }}><strong>Datos para transferir</strong>{'\n'}{instructions}</div>
            </div>
          )}
          {invoices.length > 0 && (
            <div className="input-container">
              <label>¿Qué estás pagando?</label>
              <select
                className="input-field"
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const inv = invoices.find((i) => i.id === e.target.value);
                  if (inv) setAmount(inv.balance.toFixed(2));
                }}
              >
                <option value="">Mi saldo (lo aplican al más antiguo)</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.label} · ${i.balance.toFixed(2)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-grid">
            <div className="input-container"><label>Monto transferido ($) *</label><input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="input-container"><label>Fecha</label><input type="date" className="input-field" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
            <div className="input-container span-2"><label>N.º de transferencia (opcional)</label><input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <ImageUploader kind="proof" allowPdf required label="Comprobante" value={proof} onChange={setProof} />
          <p className="muted small">Verificaremos que el dinero esté en nuestra cuenta antes de aprobar tu pago. Te avisamos por correo.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
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
