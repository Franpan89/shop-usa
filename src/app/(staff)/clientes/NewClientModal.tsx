'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import ClientForm, { type ClientFormCategory } from './ClientForm';
import type { PickableClient } from '@/components/ui/ClientPicker';

interface Props {
  categories: ClientFormCategory[];
  countries: string[];
  referrers: PickableClient[];
  defaultServiceFee: number;
}

export default function NewClientModal(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>+ Nuevo cliente</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        <ClientForm {...props} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
