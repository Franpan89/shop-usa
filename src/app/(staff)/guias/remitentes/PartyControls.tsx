'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import ActionButton from '@/components/ui/ActionButton';
import { deleteConsignee, deleteShipper, setConsigneeActive, setShipperActive } from '@/app/actions/guides';
import { ConsigneeForm, ShipperForm, type ConsigneeValues, type ShipperValues } from '../PartyForms';

/** Destinatarios · Editar · Activar/Desactivar · Eliminar (de un remitente). */
export function ShipperRowActions({ shipper, guideCount }: { shipper: ShipperValues & { id: string; active: boolean }; guideCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <Link href={`/guias/remitentes/${shipper.id}`} className="btn btn-ghost btn-sm">Destinatarios</Link>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Editar</button>
      <ActionButton
        className="btn btn-ghost btn-sm"
        success={shipper.active ? 'Remitente desactivado' : 'Remitente activado'}
        action={() => setShipperActive(shipper.id, !shipper.active)}
        onDone={() => router.refresh()}
      >
        {shipper.active ? 'Desactivar' : 'Activar'}
      </ActionButton>
      <ActionButton
        className="btn btn-ghost btn-sm"
        confirm={
          guideCount > 0
            ? `${shipper.name} ya tiene ${guideCount} guía(s): no se puede eliminar. Usa “Desactivar”.`
            : `¿Eliminar a ${shipper.name} y todos sus destinatarios? No se puede deshacer.`
        }
        confirmLabel="Eliminar"
        success="Remitente eliminado"
        action={() => deleteShipper(shipper.id)}
        onDone={() => router.refresh()}
      >
        Eliminar
      </ActionButton>
      {editing && (
        <Modal isOpen onClose={() => setEditing(false)} title={`Editar remitente: ${shipper.name}`}>
          <ShipperForm
            initial={shipper}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export function ConsigneeRowActions({
  consignee,
  shipperId,
  countries,
  guideCount,
}: {
  consignee: ConsigneeValues & { id: string; active: boolean };
  shipperId: string;
  countries: string[];
  guideCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Editar</button>
      <ActionButton
        className="btn btn-ghost btn-sm"
        success={consignee.active ? 'Destinatario desactivado' : 'Destinatario activado'}
        action={() => setConsigneeActive(consignee.id, !consignee.active)}
        onDone={() => router.refresh()}
      >
        {consignee.active ? 'Desactivar' : 'Activar'}
      </ActionButton>
      <ActionButton
        className="btn btn-ghost btn-sm"
        confirm={
          guideCount > 0
            ? `${consignee.name} ya tiene ${guideCount} guía(s): no se puede eliminar. Usa “Desactivar”.`
            : `¿Eliminar a ${consignee.name}? No se puede deshacer.`
        }
        confirmLabel="Eliminar"
        success="Destinatario eliminado"
        action={() => deleteConsignee(consignee.id)}
        onDone={() => router.refresh()}
      >
        Eliminar
      </ActionButton>
      {editing && (
        <Modal isOpen onClose={() => setEditing(false)} title={`Editar destinatario: ${consignee.name}`}>
          <ConsigneeForm
            shipperId={shipperId}
            countries={countries}
            initial={consignee}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
