'use client';

import { useState, useTransition, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { toast } from './Toast';

type Result = { ok: true } | { ok: false; error: string } | void;

interface ActionButtonProps {
  /** Función que llama a una Server Action y devuelve su resultado (recibe el texto del diálogo, si hay). */
  action: (value: string) => Promise<Result | object>;
  children: ReactNode;
  className?: string;
  /** Pide confirmación antes de ejecutar. */
  confirm?: string;
  /** Además de confirmar, pide un texto (p. ej. un motivo) que llega a `action`. */
  prompt?: { label: string; defaultValue?: string; placeholder?: string };
  confirmLabel?: string;
  success?: string;
  title?: string;
  disabled?: boolean;
  onDone?: () => void;
}

/**
 * Botón que ejecuta una acción del servidor mostrando estado de carga y el
 * motivo real si falla (por ejemplo "falta la foto" o "saldo pendiente").
 */
export default function ActionButton({
  action,
  children,
  className = 'btn btn-sm',
  confirm,
  prompt,
  confirmLabel,
  success,
  title,
  disabled,
  onDone,
}: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);

  function run(value = '') {
    startTransition(async () => {
      try {
        const result = (await action(value)) as { ok?: boolean; error?: string } | void;
        setAsking(false);
        if (result && result.ok === false) {
          toast(result.error ?? 'No se pudo completar la acción', 'error');
          return;
        }
        if (success) toast(success, 'success');
        onDone?.();
      } catch {
        setAsking(false);
        toast('No se pudo completar la acción. Intenta de nuevo.', 'error');
      }
    });
  }

  return (
    <>
      <button type="button" className={className} onClick={() => (confirm || prompt ? setAsking(true) : run())} disabled={disabled || pending} title={title}>
        {pending && !asking ? '⏳' : children}
      </button>
      {(confirm || prompt) && (
        <ConfirmDialog
          open={asking}
          message={confirm ?? prompt?.label ?? ''}
          input={prompt}
          confirmLabel={confirmLabel}
          pending={pending}
          onCancel={() => setAsking(false)}
          onConfirm={(value) => run(value)}
        />
      )}
    </>
  );
}
