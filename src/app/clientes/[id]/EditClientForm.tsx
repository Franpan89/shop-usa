'use client';

import { useState } from 'react';
import { updateClient } from '../../actions/clients';

interface EditClientFormProps {
  client: any;
}

export default function EditClientForm({ client }: EditClientFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(client.deliveryMethod || 'STORE_PICKUP');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);
    
    const formData = new FormData(event.currentTarget);
    try {
      await updateClient(client.id, formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar cliente');
    } finally {
      setIsPending(false);
    }
  }

  // Format date for input field (YYYY-MM-DD)
  const birthdayValue = client.birthday ? new Date(client.birthday).toISOString().split('T')[0] : '';

  return (
    <div className="glass-panel" style={{ padding: '32px' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>Editar Detalles</h2>
      
      <form onSubmit={handleSubmit} className="edit-client-form">
        {error && <div className="error-message">⚠️ {error}</div>}
        {success && <div className="success-message">✅ ¡Cliente actualizado correctamente!</div>}
        
        <div className="form-grid">
          <div className="input-container">
            <label>Código de Cliente</label>
            <input name="code" type="text" className="input-field" defaultValue={client.code} required />
          </div>
          <div className="input-container">
            <label>Nombre Completo</label>
            <input name="name" type="text" className="input-field" defaultValue={client.name} required />
          </div>
          <div className="input-container">
            <label>Número de Cédula o ID</label>
            <input name="idNumber" type="text" className="input-field" defaultValue={client.idNumber || ''} />
          </div>
          <div className="input-container">
            <label>Fecha de Cumpleaños</label>
            <input name="birthday" type="date" className="input-field" defaultValue={birthdayValue} />
          </div>
          <div className="input-container">
            <label>País</label>
            <select name="country" className="input-field" defaultValue={client.country} required>
              <option value="Ecuador">Ecuador</option>
              <option value="Panamá">Panamá</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div className="input-container">
            <label>Ciudad</label>
            <input name="city" type="text" className="input-field" defaultValue={client.city || ''} />
          </div>
          <div className="input-container">
            <label>Teléfono</label>
            <input name="phone" type="text" className="input-field" defaultValue={client.phone || ''} />
          </div>
          <div className="input-container">
            <label>Service Fee (%)</label>
            <input
              name="serviceFeePercent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="input-field"
              defaultValue={client.serviceFeePercent ?? 20}
            />
          </div>
          <div className="input-container">
            <label>Tarifa de envío personalizada ($ / 0.5 lbs)</label>
            <input
              name="shippingRatePerHalfLb"
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              defaultValue={client.shippingRatePerHalfLb ?? ''}
              placeholder="Dejar vacío para usar tarifa del país"
            />
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
            <div className="input-container" style={{ gridColumn: 'span 2' }}>
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

          <div className="input-container" style={{ gridColumn: 'span 2' }}>
            <label>Notas / Instrucciones Especiales</label>
            <textarea 
              name="notes" 
              className="input-field" 
              defaultValue={client.notes || ''}
              style={{ height: '100px', resize: 'vertical', padding: '12px' }}
            />
          </div>
        </div>

        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      <style jsx>{`
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 32px;
        }
        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border-left: 4px solid #ef4444;
          color: #ef4444;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          font-weight: 600;
        }
        .success-message {
          background: rgba(16, 185, 129, 0.1);
          border-left: 4px solid #10b981;
          color: #10b981;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
