'use client';

import { useTransition, type ReactNode } from 'react';
import { toast } from './Toast';

type Result = { ok: true } | { ok: false; error: string } | void;

interface ActionButtonProps {
  /** Función que llama a una Server Action y devuelve su resultado. */
  action: () => Promise<Result | object>;
  children: ReactNode;
  className?: string;
  /** Pide confirmación antes de ejecutar. */
  confirm?: string;
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
  success,
  title,
  disabled,
  onDone,
}: ActionButtonProps) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      try {
        const result = (await action()) as { ok?: boolean; error?: string } | void;
        if (result && result.ok === false) {
          toast(result.error ?? 'No se pudo completar la acción', 'error');
          return;
        }
        if (success) toast(success, 'success');
        onDone?.();
      } catch {
        toast('No se pudo completar la acción. Intenta de nuevo.', 'error');
      }
    });
  }

  return (
    <button type="button" className={className} onClick={run} disabled={disabled || pending} title={title}>
      {pending ? '⏳' : children}
    </button>
  );
}
