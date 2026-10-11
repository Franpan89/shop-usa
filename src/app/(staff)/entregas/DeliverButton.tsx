'use client';

import ActionButton from '@/components/ui/ActionButton';
import { markProductsDelivered } from '@/app/actions/logistics';

export function DeliverButton({ productIds, disabled }: { productIds: string[]; disabled: boolean }) {
  return (
    <ActionButton
      className="btn btn-success btn-sm"
      disabled={disabled}
      title={disabled ? 'Saldo pendiente: no entregar' : undefined}
      confirm={`¿Confirmas la entrega de ${productIds.length} producto(s)?`}
      success="Entrega registrada"
      action={() => markProductsDelivered(productIds)}
    >
      Marcar entregado
    </ActionButton>
  );
}
