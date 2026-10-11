'use client';

import { useTransition, type FormEvent, type ReactNode } from 'react';
import { toast } from './Toast';

type Result = { ok: true } | { ok: false; error: string } | void;

interface ActionFormProps {
  action: (formData: FormData) => Promise<Result | object>;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  success?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (result: Record<string, unknown>) => void;
}

/** <form> que llama a una Server Action y muestra el resultado o el motivo del error. */
export default function ActionForm({ action, children, className, style, success = 'Guardado', resetOnSuccess, onSuccess }: ActionFormProps) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const result = ((await action(data)) ?? {}) as { ok?: boolean; error?: string } & Record<string, unknown>;
        if (result.ok === false) {
          toast(result.error ?? 'No se pudo guardar', 'error');
          return;
        }
        toast(success, 'success');
        if (resetOnSuccess) form.reset();
        onSuccess?.(result);
      } catch {
        toast('No se pudo guardar. Intenta de nuevo.', 'error');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} style={style} aria-busy={pending}>
      <fieldset disabled={pending} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        {children}
      </fieldset>
    </form>
  );
}
