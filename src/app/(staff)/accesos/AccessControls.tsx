'use client';

import ActionButton from '@/components/ui/ActionButton';
import { approveAccessRequest, rejectAccessRequest } from '@/app/actions/access';

export function AccessActions({ id, email }: { id: string; email: string }) {
  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      <ActionButton
        className="btn btn-sm"
        confirm={`¿Ligar ${email} a este cliente y enviarle la invitación para crear su contraseña?`}
        confirmLabel="Aprobar y enviar"
        success="Aprobado: invitación enviada"
        action={() => approveAccessRequest(id)}
      >
        Aprobar
      </ActionButton>
      <ActionButton
        className="btn btn-ghost btn-sm"
        prompt={{ label: 'Motivo del rechazo (opcional)', placeholder: 'Ej. el teléfono no coincide' }}
        confirmLabel="Rechazar"
        success="Solicitud rechazada"
        action={(reason) => rejectAccessRequest(id, reason)}
      >
        Rechazar
      </ActionButton>
    </div>
  );
}
