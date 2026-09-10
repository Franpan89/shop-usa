'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsPending(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="input-container">
        <label>Nueva contraseña</label>
        <input name="password" type="password" className="input-field" required minLength={8} autoFocus />
      </div>
      <div className="input-container">
        <label>Confirmar contraseña</label>
        <input name="confirm" type="password" className="input-field" required minLength={8} />
      </div>
      <button type="submit" className="btn" disabled={isPending} style={{ marginTop: '8px' }}>
        {isPending ? 'Guardando...' : 'Guardar y continuar'}
      </button>
    </form>
  );
}
