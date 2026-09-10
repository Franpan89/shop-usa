'use client';

import { useState } from 'react';
import { notifyBoxArrival } from '../../actions/boxes';

export default function NotifyClientsButton({ boxId }: { boxId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (pending) return;
    if (!confirm('¿Enviar correo a cada cliente con productos en esta caja?')) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await notifyBoxArrival(boxId);
      setMessage(`✅ Enviado a ${result.sent} de ${result.totalClients} cliente(s)`);
    } catch (err: any) {
      setMessage(`⚠ ${err.message || 'Error al notificar'}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <button onClick={handleClick} disabled={pending} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
        {pending ? '⏳' : '📧'} Notificar a Clientes
      </button>
      {message && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{message}</span>}
    </div>
  );
}
