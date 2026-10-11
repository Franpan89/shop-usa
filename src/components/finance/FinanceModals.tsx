'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ClientPicker, { type PickableClient } from '@/components/ui/ClientPicker';
import ImageUploader from '@/components/ui/ImageUploader';
import { toast } from '@/components/ui/Toast';
import { createManualCharge, grantCredit, registerPayment } from '@/app/actions/payments';

export interface InvoiceOption {
  id: string;
  label: string;
  balance: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast(res.error ?? 'No se pudo guardar', 'error');
        return;
      }
      toast(success, 'success');
      after();
      router.refresh();
    });
  }
  return { pending, run };
}

/** Registrar un pago recibido: se registra una sola vez y el sistema lo reparte entre los cargos. */
export function RegisterPaymentModal({
  clients,
  clientId,
  invoices = [],
  defaultTargetId = '',
  trigger = '+ Registrar pago',
  triggerClassName = 'btn btn-mint',
}: {
  clients?: PickableClient[];
  clientId?: string;
  invoices?: InvoiceOption[];
  /** Factura preseleccionada (p. ej. la del pedido que se está viendo). */
  defaultTargetId?: string;
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(clientId ?? '');
  // Con una factura preseleccionada se propone su saldo pendiente.
  const [amount, setAmount] = useState(() => {
    const inv = invoices.find((i) => i.id === defaultTargetId);
    return inv ? inv.balance.toFixed(2) : '';
  });
  const [method, setMethod] = useState<'TRANSFER' | 'CASH' | 'CARD' | 'ONLINE' | 'OTHER'>('TRANSFER');
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState(defaultTargetId);
  const [proof, setProof] = useState<string | null>(null);
  const { pending, run } = useRun();

  function submit() {
    if (!client) return toast('Selecciona un cliente', 'error');
    run(
      () =>
        registerPayment({
          clientId: client,
          amount: parseFloat(amount),
          method,
          paidAt,
          reference,
          note,
          proofUrl: proof ?? undefined,
          targetInvoiceId: target || null,
        }),
      'Pago registrado y aplicado a la cuenta',
      () => {
        setOpen(false);
        setAmount('');
        setReference('');
        setNote('');
        setProof(null);
        setTarget(defaultTargetId);
      },
    );
  }

  return (
    <>
      <button className={triggerClassName} onClick={() => setOpen(true)}>{trigger}</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Registrar pago">
        <div className="stack">
          {clients && !clientId && <ClientPicker clients={clients} value={client} onChange={setClient} />}
          <div className="form-grid">
            <div className="input-container">
              <label>Monto recibido ($) *</label>
              <input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="input-container">
              <label>Método</label>
              <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="ONLINE">Pago en plataforma</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div className="input-container">
              <label>Fecha del pago</label>
              <input type="date" className="input-field" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="input-container">
              <label>N.º de transferencia / referencia</label>
              <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          {invoices.length > 0 && (
            <div className="input-container">
              <label>Aplicar a</label>
              <select className="input-field" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Automático — al saldo más antiguo primero</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.label} · pendiente ${i.balance.toFixed(2)}</option>
                ))}
              </select>
              <span className="input-hint">Lo que sobre queda como saldo a favor del cliente.</span>
            </div>
          )}
          <ImageUploader kind="proof" allowPdf label="Comprobante (opcional)" value={proof} onChange={setProof} />
          <div className="input-container">
            <label>Nota</label>
            <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn" disabled={pending || !(parseFloat(amount) > 0)} onClick={submit}>
              {pending ? '⏳ Guardando…' : 'Registrar pago'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Cargo manual en la cuenta (ajuste, servicio extra) con tax / tasa de servicio opcionales. */
export function ManualChargeModal({ clientId, taxRate, serviceRate }: { clientId: string; taxRate: number; serviceRate: number }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [applyTax, setApplyTax] = useState(false);
  const [applyService, setApplyService] = useState(false);
  const { pending, run } = useRun();

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>➕ Cargo manual</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Cargo manual">
        <div className="stack">
          <div className="input-container">
            <label>Concepto *</label>
            <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
          </div>
          <div className="input-container">
            <label>Monto ($) *</label>
            <input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <label className="check"><input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} /> Agregar tax ({taxRate}%)</label>
          <label className="check"><input type="checkbox" checked={applyService} onChange={(e) => setApplyService(e.target.checked)} /> Agregar tasa de servicio del cliente ({serviceRate}%, sobre monto + tax)</label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !description.trim() || !(parseFloat(amount) > 0)}
              onClick={() =>
                run(() => createManualCharge({ clientId, description, amount: parseFloat(amount), applyTax, applyServiceFee: applyService }), 'Cargo agregado', () => {
                  setOpen(false);
                  setDescription('');
                  setAmount('');
                })
              }
            >
              {pending ? '⏳…' : 'Agregar cargo'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Crédito a favor (compensación, cortesía): se aplica solo a los cargos pendientes. */
export function CreditModal({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const { pending, run } = useRun();

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>🎁 Crédito a favor</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Crédito a favor del cliente">
        <div className="stack">
          <div className="input-container">
            <label>Motivo *</label>
            <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cortesía, compensación, ajuste…" autoFocus />
          </div>
          <div className="input-container">
            <label>Monto ($) *</label>
            <input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={pending || !note.trim() || !(parseFloat(amount) > 0)}
              onClick={() =>
                run(() => grantCredit({ clientId, amount: parseFloat(amount), note }), 'Crédito otorgado', () => {
                  setOpen(false);
                  setNote('');
                  setAmount('');
                })
              }
            >
              {pending ? '⏳…' : 'Otorgar crédito'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
