'use client';

import { useState } from 'react';
import ActionForm from '@/components/ui/ActionForm';
import { updateOwnProfile } from '../../actions/clientProfile';

interface Props {
  client: { phone: string; deliveryMethod: string; deliveryAddress: string | null };
}

export default function EditProfileForm({ client }: Props) {
  const [deliveryMethod, setDeliveryMethod] = useState(client.deliveryMethod);

  return (
    <ActionForm action={updateOwnProfile} success="¡Datos actualizados!">
      <div className="stack" style={{ maxWidth: 480 }}>
        <div className="input-container">
          <label>Teléfono / WhatsApp</label>
          <input name="phone" type="text" className="input-field" defaultValue={client.phone} required />
        </div>
        <div className="input-container">
          <label>Preferencia de entrega</label>
          <select name="deliveryMethod" className="input-field" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
            <option value="STORE_PICKUP">Retiro en oficina</option>
            <option value="HOME_DELIVERY">Entrega a domicilio / locación</option>
          </select>
        </div>
        {deliveryMethod === 'HOME_DELIVERY' && (
          <div className="input-container">
            <label>Dirección / locación de entrega</label>
            <input name="deliveryAddress" type="text" className="input-field" defaultValue={client.deliveryAddress || ''} placeholder="Calle, número, referencia…" required />
          </div>
        )}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }}>Guardar cambios</button>
      </div>
    </ActionForm>
  );
}
