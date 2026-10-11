'use client';

import ActionButton from '@/components/ui/ActionButton';
import { deleteCountryRule } from '@/app/actions/settings';
import { deleteShippingCategory, setShippingCategoryActive } from '@/app/actions/shipping';

export function ToggleCategoryButton({ id, active }: { id: string; active: boolean }) {
  return (
    <ActionButton className="btn btn-ghost btn-sm" success={active ? 'Tarifa desactivada' : 'Tarifa activada'} action={() => setShippingCategoryActive(id, !active)}>
      {active ? 'Desactivar' : 'Activar'}
    </ActionButton>
  );
}

export function DeleteCategoryButton({ id }: { id: string }) {
  return (
    <ActionButton className="btn btn-ghost btn-sm" confirm="¿Eliminar esta tarifa?" success="Tarifa eliminada" action={() => deleteShippingCategory(id)}>
      Eliminar
    </ActionButton>
  );
}

export function DeleteCountryButton({ id, name }: { id: string; name: string }) {
  return (
    <ActionButton className="btn btn-ghost btn-sm" confirm={`¿Eliminar ${name}?`} success="País eliminado" action={() => deleteCountryRule(id)}>
      Eliminar
    </ActionButton>
  );
}
