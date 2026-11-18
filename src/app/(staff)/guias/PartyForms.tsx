'use client';

import ActionForm from '@/components/ui/ActionForm';
import { ID_KIND, EC_PROVINCES } from '@/lib/domain/guides';
import { createConsignee, createShipper, updateConsignee, updateShipper } from '@/app/actions/guides';

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '');

const ID_OPTIONS = Object.entries(ID_KIND);

function IdKindSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="input-container">
      <label>Tipo de identificación</label>
      <select name="idKind" className="input-field" defaultValue={defaultValue ?? 'CEDULA'}>
        {ID_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Remitente ───────────────────────────────────────────────────────────────

export interface ShipperValues {
  id?: string;
  name: string;
  idKind: string;
  idNumber: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

/** Alta o edición de un remitente (quien envía desde Estados Unidos). */
export function ShipperForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial?: ShipperValues;
  submitLabel?: string;
  onSaved?: (result: Record<string, unknown>) => void;
}) {
  const id = initial?.id;
  return (
    <ActionForm
      action={(fd) => {
        const input = {
          name: str(fd, 'name'),
          idKind: str(fd, 'idKind'),
          idNumber: str(fd, 'idNumber'),
          address: str(fd, 'address'),
          city: str(fd, 'city'),
          state: str(fd, 'state'),
          phone: str(fd, 'phone'),
          email: str(fd, 'email'),
        };
        return id ? updateShipper(id, input) : createShipper(input);
      }}
      success={id ? 'Remitente actualizado' : 'Remitente guardado'}
      resetOnSuccess={!id}
      onSuccess={onSaved}
    >
      <div className="form-grid">
        <div className="input-container">
          <label>Nombre completo</label>
          <input name="name" className="input-field" required defaultValue={initial?.name} placeholder="APELLIDOS NOMBRES" autoComplete="off" />
        </div>
        <IdKindSelect defaultValue={initial?.idKind} />
        <div className="input-container">
          <label>Identificación</label>
          <input name="idNumber" className="input-field" defaultValue={initial?.idNumber} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Dirección en EE.UU.</label>
          <input name="address" className="input-field" defaultValue={initial?.address} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Ciudad</label>
          <input name="city" className="input-field" defaultValue={initial?.city} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Estado</label>
          <input name="state" className="input-field" defaultValue={initial ? initial.state : 'Florida'} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Teléfono</label>
          <input name="phone" className="input-field" defaultValue={initial?.phone} inputMode="tel" autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Correo</label>
          <input name="email" type="email" className="input-field" defaultValue={initial?.email} autoComplete="off" />
          <span className="input-hint">Opcional.</span>
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button type="submit" className="btn">{submitLabel ?? (id ? 'Guardar cambios' : 'Guardar remitente')}</button>
      </div>
    </ActionForm>
  );
}

// ── Destinatario ────────────────────────────────────────────────────────────

export interface ConsigneeValues {
  id?: string;
  name: string;
  idKind: string;
  idNumber: string;
  country: string;
  province: string;
  city: string;
  declaredAddress: string;
  deliveryAddress: string;
  reference: string;
  phone: string;
  relationship: string;
}

/** Alta o edición de un destinatario (quien recibe en destino), siempre ligado a un remitente. */
export function ConsigneeForm({
  shipperId,
  countries,
  initial,
  submitLabel,
  onSaved,
}: {
  shipperId: string;
  countries: string[];
  initial?: ConsigneeValues;
  submitLabel?: string;
  onSaved?: (result: Record<string, unknown>) => void;
}) {
  const id = initial?.id;
  const country = initial?.country || countries[0] || 'ECUADOR';
  const countryOptions = countries.some((c) => c.toUpperCase() === country.toUpperCase()) ? countries : [country, ...countries];
  return (
    <ActionForm
      action={(fd) => {
        const input = {
          name: str(fd, 'name'),
          idKind: str(fd, 'idKind'),
          idNumber: str(fd, 'idNumber'),
          country: str(fd, 'country'),
          province: str(fd, 'province'),
          city: str(fd, 'city'),
          declaredAddress: str(fd, 'declaredAddress'),
          deliveryAddress: str(fd, 'deliveryAddress'),
          reference: str(fd, 'reference'),
          phone: str(fd, 'phone'),
          relationship: str(fd, 'relationship'),
        };
        return id ? updateConsignee(id, input) : createConsignee(shipperId, input);
      }}
      success={id ? 'Destinatario actualizado' : 'Destinatario guardado'}
      resetOnSuccess={!id}
      onSuccess={onSaved}
    >
      <div className="form-grid">
        <div className="input-container">
          <label>Nombre completo</label>
          <input name="name" className="input-field" required defaultValue={initial?.name} placeholder="APELLIDOS NOMBRES" autoComplete="off" />
        </div>
        <IdKindSelect defaultValue={initial?.idKind} />
        <div className="input-container">
          <label>Identificación</label>
          <input name="idNumber" className="input-field" defaultValue={initial?.idNumber} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>País</label>
          <select name="country" className="input-field" defaultValue={country}>
            {countryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="input-container">
          <label>Provincia</label>
          <input name="province" className="input-field" list="ec-provinces" defaultValue={initial?.province} autoComplete="off" />
          <datalist id="ec-provinces">
            {EC_PROVINCES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="input-container">
          <label>Ciudad / cantón</label>
          <input name="city" className="input-field" defaultValue={initial?.city} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Dirección declarada</label>
          <input name="declaredAddress" className="input-field" defaultValue={initial?.declaredAddress} autoComplete="off" />
          <span className="input-hint">La que va al manifiesto aduanero.</span>
        </div>
        <div className="input-container">
          <label>Dirección real de entrega</label>
          <input name="deliveryAddress" className="input-field" defaultValue={initial?.deliveryAddress} placeholder="Igual a la anterior si se deja vacía" autoComplete="off" />
          <span className="input-hint">Solo si siempre se le entrega en otra parte. Para un envío suelto, usa la casilla de entrega final al crear la guía.</span>
        </div>
        <div className="input-container">
          <label>Referencia</label>
          <input name="reference" className="input-field" defaultValue={initial?.reference} autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Teléfono</label>
          <input name="phone" className="input-field" defaultValue={initial?.phone} inputMode="tel" autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Parentesco</label>
          <input name="relationship" className="input-field" defaultValue={initial?.relationship} placeholder="HERMANO, MADRE…" autoComplete="off" />
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button type="submit" className="btn">{submitLabel ?? (id ? 'Guardar cambios' : 'Guardar destinatario')}</button>
      </div>
    </ActionForm>
  );
}
