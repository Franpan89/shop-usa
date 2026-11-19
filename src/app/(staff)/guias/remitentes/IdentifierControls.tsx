'use client';

import { useRouter } from 'next/navigation';
import ActionButton from '@/components/ui/ActionButton';
import { deleteGuideIdentifier, setGuideIdentifierActive } from '@/app/actions/guides';

/** Activar/Desactivar · Eliminar (solo si nunca se usó) de un identificador adicional a PKG. */
export function IdentifierRowActions({ id, prefix, active, used }: { id: string; prefix: string; active: boolean; used: number }) {
  const router = useRouter();
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <ActionButton
        className="btn btn-ghost btn-sm"
        success={active ? 'Identificador desactivado' : 'Identificador activado'}
        action={() => setGuideIdentifierActive(id, !active)}
        onDone={() => router.refresh()}
      >
        {active ? 'Desactivar' : 'Activar'}
      </ActionButton>
      <ActionButton
        className="btn btn-ghost btn-sm"
        confirm={used > 0 ? `${prefix} ya está en ${used} guía(s): no se puede eliminar. Usa “Desactivar”.` : `¿Eliminar el identificador ${prefix}? No se puede deshacer.`}
        confirmLabel="Eliminar"
        success="Identificador eliminado"
        action={() => deleteGuideIdentifier(id)}
        onDone={() => router.refresh()}
      >
        Eliminar
      </ActionButton>
    </div>
  );
}
