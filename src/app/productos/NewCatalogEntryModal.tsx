'use client';

import { useState } from 'react';
import CatalogEntryForm from './CatalogEntryForm';
import { createCatalogEntry } from '../actions/productCatalog';

export default function NewCatalogEntryModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + Nuevo Producto
      </button>
      <CatalogEntryForm
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Nuevo Producto"
        onSubmit={async (values) => {
          await createCatalogEntry(values);
        }}
      />
    </>
  );
}
