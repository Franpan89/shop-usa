'use client';

import { useState } from 'react';
import ActionButton from '@/components/ui/ActionButton';
import { invitePortalClient } from '@/app/actions/portal';
import { setCustodyActive } from '@/app/actions/custody';

export function InvitePortalButton({ clientId, hasEmail }: { clientId: string; hasEmail: boolean }) {
  return (
    <ActionButton
      className="btn btn-secondary btn-sm"
      disabled={!hasEmail}
      title={hasEmail ? 'Envía una invitación para crear su contraseña' : 'El cliente no tiene correo'}
      confirm="¿Enviar la invitación al portal del cliente?"
      success="Invitación enviada"
      action={() => invitePortalClient(clientId)}
    >
      ✉️ Invitar al portal
    </ActionButton>
  );
}

/** Custodio de paquetería: apagado por defecto; Shop USA lo activa a mano con la fecha límite del cliente. */
export function CustodyToggle({ clientId, active, deadline }: { clientId: string; active: boolean; deadline: string | null }) {
  const [date, setDate] = useState(deadline ?? '');
  return (
    <div className="stack-sm">
      {active ? (
        <div className="row">
          <div className="input-container">
            <label>Fecha límite de custodia</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ActionButton className="btn btn-secondary btn-sm" success="Fecha actualizada" action={() => setCustodyActive(clientId, true, date)} disabled={!date}>
            Guardar fecha
          </ActionButton>
          <ActionButton
            className="btn btn-ghost btn-sm"
            confirm="¿Desactivar el servicio de Custodio para este cliente?"
            success="Custodio desactivado"
            action={() => setCustodyActive(clientId, false)}
          >
            Desactivar
          </ActionButton>
        </div>
      ) : (
        <div className="row">
          <div className="input-container">
            <label>Fecha límite que indicó el cliente</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ActionButton className="btn btn-sm" success="Custodio activado" action={() => setCustodyActive(clientId, true, date)} disabled={!date}>
            Activar custodio
          </ActionButton>
        </div>
      )}
    </div>
  );
}
