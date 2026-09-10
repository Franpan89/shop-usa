'use client';

import { useState } from 'react';
import { updateOwnProfile } from '../../actions/clientProfile';

interface Props {
  client: { phone: string; deliveryMethod: string; deliveryAddress: string | null };
}

export default function EditProfileForm({ client }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(client.deliveryMethod);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);
    const formData = new FormData(event.currentTarget);
    try {
      await updateOwnProfile(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.1)', borderLeft: '4px solid #10b981', color: '#10b981', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ✅ ¡Datos actualizados!
        </div>
      )}
      <div className="input-container">
        <label>Teléfono</label>
        <input name="phone" type="text" className="input-field" defaultValue={client.phone} required />
      </div>
      <div className="input-container">
        <label>Preferencia de Entrega</label>
        <select
          name="deliveryMethod"
          className="input-field"
          value={deliveryMethod}
          onChange={(e) => setDeliveryMethod(e.target.value)}
        >
          <option value="STORE_PICKUP">Retiro en Tienda</option>
          <option value="HOME_DELIVERY">Envío a Domicilio / Locación</option>
        </select>
      </div>
      {deliveryMethod === 'HOME_DELIVERY' && (
        <div className="input-container">
          <label>Dirección / Locación de Entrega</label>
          <input
            name="deliveryAddress"
            type="text"
            className="input-field"
            defaultValue={client.deliveryAddress || ''}
            placeholder="Calle, Número, Referencia..."
            required
          />
        </div>
      )}
      <button type="submit" className="btn" disabled={isPending} style={{ alignSelf: 'flex-start' }}>
        {isPending ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </form>
  );
}
