'use client';

import ActionButton from '@/components/ui/ActionButton';
import { deleteCasilleroItem } from '@/app/actions/purchasing';

export default function RecentRow({ productId, canDelete }: { productId: string; canDelete: boolean }) {
  if (!canDelete) return null;
  return (
    <ActionButton className="btn btn-ghost btn-sm" confirm="¿Eliminar este producto de Casillero? (registrado por error)" success="Producto eliminado" action={() => deleteCasilleroItem(productId)}>
      🗑️
    </ActionButton>
  );
}
