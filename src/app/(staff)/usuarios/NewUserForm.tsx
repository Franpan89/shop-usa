'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createStaffUser } from '../../actions/users';

export default function NewUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await createStaffUser(formData);
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>+ Nuevo Usuario</button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Nuevo Usuario">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Nombre Completo</label>
              <input name="name" type="text" className="input-field" required />
            </div>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Correo</label>
              <input name="email" type="email" className="input-field" required />
            </div>
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
              <label>Rol</label>
              <select name="role" className="input-field" defaultValue="SUBADMIN">
                <option value="SUBADMIN">Sub-admin</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Se le enviará un correo de invitación para que configure su contraseña.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? '⏳ Invitando...' : '📧 Invitar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
