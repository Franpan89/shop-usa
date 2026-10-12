'use client';

import { useRouter } from 'next/navigation';
import ActionButton from '@/components/ui/ActionButton';
import { authorizeCourtesy, cancelOrder, revokeCourtesy } from '@/app/actions/orders';
import { markProductsPurchased, undoProductPurchased } from '@/app/actions/purchasing';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  return (
    <ActionButton
      className="btn btn-ghost btn-sm"
      success="Pedido cancelado"
      confirm="Se liberarán los pagos aplicados a este pedido."
      prompt={{ label: 'Motivo de la cancelación (opcional)' }}
      confirmLabel="Cancelar pedido"
      action={async (reason) => {
        const res = await cancelOrder(orderId, reason);
        if (res.ok) router.refresh();
        return res;
      }}
    >
      Cancelar pedido
    </ActionButton>
  );
}

/** Excepción al prepago: solo administradores (7.4). */
export function CourtesyButton({ orderId, authorized }: { orderId: string; authorized: boolean }) {
  return authorized ? (
    <ActionButton className="btn btn-ghost btn-sm" confirm="¿Quitar la autorización de compra a crédito?" success="Autorización retirada" action={() => revokeCourtesy(orderId)}>
      Quitar autorización
    </ActionButton>
  ) : (
    <ActionButton
      className="btn btn-secondary btn-sm"
      confirm="Autorizar la compra SIN pago completo. El valor pendiente quedará como cargo en la cuenta del cliente. ¿Continuar?"
      success="Compra autorizada a crédito"
      action={() => authorizeCourtesy(orderId)}
    >
      🤝 Autorizar compra a crédito
    </ActionButton>
  );
}

export function PurchaseButton({ productId, purchased }: { productId: string; purchased: boolean }) {
  return purchased ? (
    <ActionButton className="btn btn-ghost btn-sm" success="Compra deshecha" action={() => undoProductPurchased(productId)}>Deshacer</ActionButton>
  ) : (
    <ActionButton className="btn btn-sm" success="Marcado como comprado" action={() => markProductsPurchased([productId])}>🛍️ Comprado</ActionButton>
  );
}

export function PurchaseAllButton({ productIds }: { productIds: string[] }) {
  return (
    <ActionButton className="btn btn-secondary btn-sm" success="Productos marcados como comprados" action={() => markProductsPurchased(productIds)}>
      Marcar los {productIds.length} listos como comprados
    </ActionButton>
  );
}
