'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  /** Si se indica, muestra un campo de texto y entrega su valor al confirmar. */
  input?: { label: string; defaultValue?: string; placeholder?: string };
  pending?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Confirmación dentro de la aplicación. Reemplaza a window.confirm / window.prompt, que algunos
 * navegadores integrados bloquean en silencio (el botón "no hacía nada").
 */
export default function ConfirmDialog({ open, title = 'Confirmar', message, confirmLabel = 'Confirmar', input, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const [value, setValue] = useState(input?.defaultValue ?? '');
  return (
    <Modal isOpen={open} onClose={onCancel} title={title}>
      <div className="stack">
        <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
        {input && (
          <div className="input-container">
            <label>{input.label}</label>
            <input className="input-field" value={value} placeholder={input.placeholder} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn" disabled={pending} onClick={() => onConfirm(value)}>
            {pending ? '⏳…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
