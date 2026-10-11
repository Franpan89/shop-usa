'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ActionForm from '@/components/ui/ActionForm';
import ClientPicker, { type PickableClient } from '@/components/ui/ClientPicker';
import { createClient, updateClient } from '@/app/actions/clients';

export interface ClientFormCategory {
  id: string;
  name: string;
  country: string;
  pricePerLb: number;
  unit: 'HALF_LB' | 'LB';
  active: boolean;
}

export interface ClientFormValues {
  id: string;
  code: string;
  name: string;
  idNumber: string | null;
  email: string | null;
  phone: string;
  country: string;
  city: string;
  deliveryMethod: 'STORE_PICKUP' | 'HOME_DELIVERY';
  deliveryAddress: string | null;
  serviceFeePercent: number;
  shippingCategoryId: string | null;
  referredById: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  notes: string | null;
  /** Si el referido ya generó su beneficio, el vínculo no se puede cambiar. */
  referralLocked?: boolean;
}

interface ClientFormProps {
  client?: ClientFormValues;
  categories: ClientFormCategory[];
  countries: string[];
  referrers: PickableClient[];
  defaultServiceFee: number;
  onDone?: () => void;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const unitLabel = (c: ClientFormCategory) => `$${c.pricePerLb.toFixed(2)}/lb · ${c.unit === 'LB' ? 'libra completa' : 'fracciones de 0.5 lb'}`;

/** Ficha del cliente (1.1): se usa tanto para crear como para editar. */
export default function ClientForm({ client, categories, countries, referrers, defaultServiceFee, onDone }: ClientFormProps) {
  const router = useRouter();
  const isEdit = !!client;
  const [country, setCountry] = useState(client?.country ?? '');
  const [categoryId, setCategoryId] = useState(client?.shippingCategoryId ?? '');
  const [referredById, setReferredById] = useState(client?.referredById ?? '');
  const [delivery, setDelivery] = useState<'STORE_PICKUP' | 'HOME_DELIVERY'>(client?.deliveryMethod ?? 'STORE_PICKUP');

  // El país determina qué tarifas de envío pueden asignarse (1.2).
  const countryCategories = useMemo(
    () => categories.filter((c) => c.country === country && (c.active || c.id === client?.shippingCategoryId)),
    [categories, country, client?.shippingCategoryId],
  );

  const potentialReferrers = referrers.filter((r) => r.id !== client?.id);

  return (
    <ActionForm
      action={(fd) => (isEdit ? updateClient(client!.id, fd) : createClient(fd))}
      success={isEdit ? 'Cliente actualizado' : 'Cliente creado'}
      onSuccess={(result) => {
        if (!isEdit && typeof result.clientId === 'string') router.push(`/clientes/${result.clientId}`);
        else router.refresh();
        onDone?.();
      }}
    >
      <div className="stack">
        {!isEdit && (
          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            <span>🔖</span>
            <div>El código del cliente (EC001, PTY004…) se genera solo al guardar y es permanente.</div>
          </div>
        )}

        <div className="form-grid">
          <div className="input-container span-2">
            <label>Nombre y apellido *</label>
            <input name="name" className="input-field" defaultValue={client?.name} required />
          </div>
          <div className="input-container">
            <label>Teléfono / WhatsApp *</label>
            <input name="phone" className="input-field" defaultValue={client?.phone} required placeholder="+593 99 123 4567" />
          </div>
          <div className="input-container">
            <label>Correo electrónico</label>
            <input name="email" type="email" className="input-field" defaultValue={client?.email ?? ''} placeholder="si tiene" />
          </div>
          <div className="input-container">
            <label>País de destino *</label>
            <select
              name="country"
              className="input-field"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setCategoryId('');
              }}
              required
            >
              <option value="">Selecciona…</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="input-container">
            <label>Ciudad</label>
            <input name="city" className="input-field" defaultValue={client?.city} />
          </div>
          <div className="input-container">
            <label>Cumpleaños (mes y día)</label>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <select name="birthdayMonth" className="input-field grow" defaultValue={client?.birthdayMonth ?? ''}>
                <option value="">Mes</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select name="birthdayDay" className="input-field" defaultValue={client?.birthdayDay ?? ''} style={{ width: 84 }}>
                <option value="">Día</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-container">
            <label>Cédula / ID</label>
            <input name="idNumber" className="input-field" defaultValue={client?.idNumber ?? ''} />
          </div>
        </div>

        <div>
          <h3 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: 4 }}>Condiciones comerciales</h3>
          <p className="panel-sub" style={{ marginBottom: 12 }}>
            La tarifa de envío y la tasa de servicio son independientes: cada cliente puede tener cualquier combinación.
          </p>
          <div className="form-grid">
            <div className="input-container">
              <label>Tarifa de envío</label>
              <select
                name="shippingCategoryId"
                className="input-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!country}
              >
                <option value="">{country ? 'Sin tarifa asignada' : 'Elige primero el país'}</option>
                {countryCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {unitLabel(c)}{c.active ? '' : ' (inactiva)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-container">
              <label>Tasa de servicio Personal Shopper (%)</label>
              <input
                name="serviceFeePercent"
                type="number"
                step="0.5"
                min="0"
                max="100"
                className="input-field"
                defaultValue={client?.serviceFeePercent ?? defaultServiceFee}
              />
              <span className="input-hint">20 % general · 10 % familiar. Se calcula sobre productos + tax.</span>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="input-container">
            <label>Entrega</label>
            <select
              name="deliveryMethod"
              className="input-field"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value as 'STORE_PICKUP' | 'HOME_DELIVERY')}
            >
              <option value="STORE_PICKUP">Retira en oficina</option>
              <option value="HOME_DELIVERY">Entrega a domicilio</option>
            </select>
          </div>
          <div className="input-container">
            <label>Dirección{delivery === 'HOME_DELIVERY' ? ' *' : ''}</label>
            <input name="deliveryAddress" className="input-field" defaultValue={client?.deliveryAddress ?? ''} required={delivery === 'HOME_DELIVERY'} />
          </div>
          <div className="span-2">
            <input type="hidden" name="referredById" value={referredById} />
            <ClientPicker
              label={`Referido por${client?.referralLocked ? ' (ya generó su beneficio)' : ''}`}
              clients={potentialReferrers}
              value={referredById}
              onChange={setReferredById}
              disabled={client?.referralLocked}
              placeholder="Opcional — cliente que lo recomendó"
            />
            {referredById && !client?.referralLocked && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setReferredById('')}>
                Quitar referido
              </button>
            )}
          </div>
          <div className="input-container span-2">
            <label>Observaciones internas</label>
            <textarea name="notes" className="input-field" defaultValue={client?.notes ?? ''} />
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn">{isEdit ? 'Guardar cambios' : 'Crear cliente'}</button>
        </div>
      </div>
    </ActionForm>
  );
}
