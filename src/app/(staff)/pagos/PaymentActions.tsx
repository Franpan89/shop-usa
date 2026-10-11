'use client';

import ActionButton from '@/components/ui/ActionButton';
import { voidPaymentAction } from '@/app/actions/payments';

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  return (
    <ActionButton
      className="btn btn-ghost btn-sm"
      confirm="¿Anular este pago? El dinero se libera de las facturas que cubría y se vuelve a aplicar el saldo."
      success="Pago anulado"
      action={() => voidPaymentAction(paymentId)}
    >
      Anular
    </ActionButton>
  );
}
