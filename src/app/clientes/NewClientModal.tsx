'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createClient } from '../actions/clients';

export default function NewClientModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState('STORE_PICKUP');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    
    const formData = new FormData(event.currentTarget);
    try {
      await createClient(formData);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al crear cliente. Por favor verifica los campos.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => {
        setIsOpen(true);
        setError(null);
      }}>
        + Nuevo Cliente
      </button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title="Nuevo Cliente"
      >
        <form onSubmit={handleSubmit} className="new-client-form">
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
          <div className="form-grid">
            <div className="input-container">
              <label>Código de Cliente</label>
              <input name="code" type="text" className="input-field" placeholder="Ej: EC00353" required />
            </div>
            <div className="input-container">
              <label>Nombre Completo</label>
              <input name="name" type="text" className="input-field" placeholder="Nombre del cliente" required />
            </div>
            <div className="input-container">
              <label>Número de Cédula o ID</label>
              <input name="idNumber" type="text" className="input-field" placeholder="ID / Cédula" />
            </div>
            <div className="input-container">
              <label>Fecha de Cumpleaños</label>
              <input name="birthday" type="date" className="input-field" />
            </div>
            <div className="input-container">
              <label>País</label>
              <select name="country" className="input-field" required>
                <option value="Ecuador">Ecuador</option>
                <option value="Panamá">Panamá</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="input-container">
              <label>Ciudad</label>
              <input name="city" type="text" className="input-field" placeholder="Ciudad" />
            </div>
            <div className="input-container">
              <label>Teléfono</label>
              <input name="phone" type="text" className="input-field" placeholder="+593 ..." />
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
                placeholder="Ej: Cómo enviar los paquetes, preferencias especiales, etc."
                style={{ height: '80px', resize: 'vertical', padding: '12px' }}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar Cliente'}
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
          .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 16px;
          }
          .new-client-form {
            display: flex;
            flex-direction: column;
          }
          .error-message {
            background: rgba(239, 68, 68, 0.1);
            border-left: 4px solid #ef4444;
            color: #ef4444;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-weight: 600;
            font-size: 0.95rem;
          }
        `}</style>
      </Modal>
    </>
  );
}
