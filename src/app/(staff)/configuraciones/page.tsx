import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { getCountryRules, getSettings, getTenantId } from '@/lib/tenant';
import { billableWeight, shippingCost } from '@/lib/domain/pricing';
import { Alert, PageHeader, Panel, Tabs, ToneBadge, money } from '@/components/ui/kit';
import ActionForm from '@/components/ui/ActionForm';
import ActionButton from '@/components/ui/ActionButton';
import {
  deleteCountryRule,
  savePaymentInstructions,
  saveCountryRule,
  saveCustody,
  savePkgNumbering,
  saveRates,
  saveRetention,
  setNextClientNumber,
} from '@/app/actions/settings';
import { createShippingCategory, deleteShippingCategory, setShippingCategoryActive, updateShippingCategory } from '@/app/actions/shipping';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  ['tarifas', 'Tarifas de envío'],
  ['tasas', 'Tasas e impuestos'],
  ['paises', 'Países y reglas'],
  ['consolidacion', 'Consolidación y retención'],
  ['pkg', 'PKG y clientes'],
  ['custodio', 'Custodio'],
  ['pagos', 'Datos de pago'],
] as const;

function Field({ label, name, defaultValue, type = 'number', step = '0.01', hint, min = '0', required = true }: { label: string; name: string; defaultValue?: string | number; type?: string; step?: string; hint?: string; min?: string; required?: boolean }) {
  return (
    <div className="input-container">
      <label>{label}</label>
      <input name={name} type={type} step={step} min={type === 'number' ? min : undefined} className="input-field" defaultValue={defaultValue} required={required} />
      {hint && <span className="input-hint">{hint}</span>}
    </div>
  );
}

export default async function ConfiguracionesPage({ searchParams }: { searchParams: Promise<{ seccion?: string }> }) {
  await requireAdmin();
  const { seccion = 'tarifas' } = await searchParams;
  const tenantId = await getTenantId();
  const settings = await getSettings();
  const [categories, rules, clientCounter] = await Promise.all([
    prisma.shippingCategory.findMany({ where: { tenantId }, include: { _count: { select: { clients: true } } }, orderBy: [{ country: 'asc' }, { name: 'asc' }] }),
    getCountryRules(),
    prisma.counter.findUnique({ where: { tenantId_key: { tenantId, key: 'client' } } }),
  ]);
  const countries = rules.map((r) => r.name);

  return (
    <>
      <PageHeader title="Configuraciones" subtitle="Todo lo que Shop USA puede cambiar sin pedir un cambio de código: tarifas, tasas, reglas por país y políticas." />
      <Tabs items={SECTIONS.map(([key, label]) => ({ href: `/configuraciones?seccion=${key}`, label, active: seccion === key }))} />

      {seccion === 'tarifas' && (
        <div className="stack">
          <Alert tone="info">El precio es <strong>por libra</strong>. “Fracciones de 0.5 lb” redondea el peso al siguiente 0.5; “libra completa” lo redondea a la siguiente libra. Cambiar una tarifa no altera consolidados ya cerrados.</Alert>
          {categories.map((c) => {
            const example = 6.37;
            return (
              <Panel
                key={c.id}
                title={c.name}
                subtitle={`${c.country} · ${c._count.clients} cliente(s)`}
                actions={
                  <>
                    <ToneBadge tone={c.active ? 'success' : 'secondary'}>{c.active ? 'Activa' : 'Inactiva'}</ToneBadge>
                    <ActionButton className="btn btn-ghost btn-sm" success={c.active ? 'Tarifa desactivada' : 'Tarifa activada'} action={() => setShippingCategoryActive(c.id, !c.active)}>{c.active ? 'Desactivar' : 'Activar'}</ActionButton>
                  </>
                }
              >
                <ActionForm action={updateShippingCategory} success="Tarifa actualizada">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="form-grid">
                    <Field label="Nombre" name="name" type="text" defaultValue={c.name} />
                    <div className="input-container">
                      <label>País</label>
                      <select name="country" className="input-field" defaultValue={c.country}>{countries.map((x) => <option key={x}>{x}</option>)}</select>
                    </div>
                    <Field label="Precio por libra ($)" name="pricePerLb" defaultValue={c.pricePerLb} min="0.01" />
                    <div className="input-container">
                      <label>Se factura por</label>
                      <select name="unit" className="input-field" defaultValue={c.unit}>
                        <option value="HALF_LB">Fracciones de 0.5 lb</option>
                        <option value="LB">Libra completa</option>
                      </select>
                    </div>
                  </div>
                  <div className="row-between" style={{ marginTop: 14 }}>
                    <span className="muted small">Ejemplo: {example} lb reales → {billableWeight(example, c.unit)} lb facturables → <strong>{money(shippingCost(example, c.pricePerLb, c.unit))}</strong></span>
                    <div className="row">
                      <button type="submit" className="btn btn-sm">Guardar</button>
                    </div>
                  </div>
                </ActionForm>
                {c._count.clients === 0 && (
                  <div style={{ marginTop: 10 }}>
                    <ActionButton className="btn btn-ghost btn-sm" confirm="¿Eliminar esta tarifa?" success="Tarifa eliminada" action={() => deleteShippingCategory(c.id)}>Eliminar</ActionButton>
                  </div>
                )}
              </Panel>
            );
          })}
          <Panel title="Nueva tarifa">
            <ActionForm action={createShippingCategory} success="Tarifa creada" resetOnSuccess>
              <div className="form-grid">
                <Field label="Nombre" name="name" type="text" />
                <div className="input-container"><label>País</label><select name="country" className="input-field">{countries.map((x) => <option key={x}>{x}</option>)}</select></div>
                <Field label="Precio por libra ($)" name="pricePerLb" min="0.01" />
                <div className="input-container"><label>Se factura por</label><select name="unit" className="input-field"><option value="HALF_LB">Fracciones de 0.5 lb</option><option value="LB">Libra completa</option></select></div>
              </div>
              <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Crear tarifa</button>
            </ActionForm>
          </Panel>
        </div>
      )}

      {seccion === 'tasas' && (
        <Panel title="Tasas e impuestos" subtitle="La tasa de servicio de cada cliente se ajusta en su ficha; aquí están los valores generales.">
          <ActionForm action={saveRates} success="Tasas guardadas">
            <div className="form-grid">
              <Field label="Tax (sales tax) %" name="taxRatePercent" defaultValue={settings.taxRatePercent} step="0.01" hint="Se aplica sobre el valor de los productos." />
              <Field label="Tasa Personal Shopper sugerida %" name="personalShopperRatePercent" defaultValue={settings.personalShopperRatePercent} step="0.5" hint="Valor por defecto al crear un cliente (20 % general, 10 % familiar)." />
              <Field label="Tasa “Compramos tu carrito” %" name="cartServiceRatePercent" defaultValue={settings.cartServiceRatePercent} step="0.5" hint="Sobre productos + sales tax." />
              <Field label="Beneficio por referido (puntos)" name="referralDiscountPoints" defaultValue={settings.referralDiscountPoints} step="0.5" hint="Puntos porcentuales menos en la tasa de UNA factura de Personal Shopper." />
            </div>
            <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Guardar</button>
          </ActionForm>
        </Panel>
      )}

      {seccion === 'paises' && (
        <div className="stack">
          <Alert tone="info">Cada país define cómo se despacha y se entrega. Para agregar Colombia, Perú u otro destino basta crear una fila nueva: el prefijo se usa para el código de cliente (EC001, PTY004…).</Alert>
          {rules.map((r) => (
            <Panel key={r.id} title={`${r.name} · prefijo ${r.codePrefix}`} actions={<ToneBadge tone={r.active ? 'success' : 'secondary'}>{r.active ? 'Activo' : 'Inactivo'}</ToneBadge>}>
              <ActionForm action={saveCountryRule} success="País actualizado">
                <input type="hidden" name="id" value={r.id} />
                <div className="form-grid">
                  <Field label="País" name="name" type="text" defaultValue={r.name} />
                  <Field label="Prefijo del código" name="codePrefix" type="text" defaultValue={r.codePrefix} />
                </div>
                <div className="stack-sm" style={{ margin: '14px 0' }}>
                  <label className="check"><input type="checkbox" name="active" defaultChecked={r.active} /> País activo (aparece al crear clientes)</label>
                  <label className="check"><input type="checkbox" name="allowDispatchWithBalance" defaultChecked={r.allowDispatchWithBalance} /> Permitir despacho internacional con saldo pendiente</label>
                  <label className="check"><input type="checkbox" name="requireFullPaymentBeforeDelivery" defaultChecked={r.requireFullPaymentBeforeDelivery} /> Exigir pago completo antes de la entrega</label>
                  <label className="check"><input type="checkbox" name="usesDeconsolidation" defaultChecked={r.usesDeconsolidation} /> Usa cajas compartidas y desconsolidación</label>
                </div>
                <div className="row">
                  <button type="submit" className="btn btn-sm">Guardar</button>
                  <ActionButton className="btn btn-ghost btn-sm" confirm={`¿Eliminar ${r.name}?`} success="País eliminado" action={() => deleteCountryRule(r.id)}>Eliminar</ActionButton>
                </div>
              </ActionForm>
            </Panel>
          ))}
          <Panel title="Nuevo país de destino">
            <ActionForm action={saveCountryRule} success="País creado" resetOnSuccess>
              <div className="form-grid"><Field label="País" name="name" type="text" /><Field label="Prefijo (2–4 letras)" name="codePrefix" type="text" /></div>
              <div className="stack-sm" style={{ margin: '14px 0' }}>
                <label className="check"><input type="checkbox" name="requireFullPaymentBeforeDelivery" defaultChecked /> Exigir pago completo antes de la entrega</label>
                <label className="check"><input type="checkbox" name="allowDispatchWithBalance" /> Permitir despacho internacional con saldo pendiente</label>
                <label className="check"><input type="checkbox" name="usesDeconsolidation" /> Usa cajas compartidas y desconsolidación</label>
              </div>
              <button type="submit" className="btn btn-sm">Crear país</button>
            </ActionForm>
          </Panel>
        </div>
      )}

      {seccion === 'consolidacion' && (
        <Panel title="Retención de mercancía" subtitle="La política es comercial: el sistema avisa pero nunca bloquea ni despacha por su cuenta.">
          <ActionForm action={saveRetention} success="Política guardada">
            <div className="form-grid">
              <Field label="Advertencia de retención prolongada (días)" name="retentionWarningDays" defaultValue={settings.retentionWarningDays} step="1" min="1" />
              <Field label="Máximo aproximado de retención (días)" name="retentionMaxDays" defaultValue={settings.retentionMaxDays} step="1" min="1" />
            </div>
            <label className="check" style={{ margin: '14px 0' }}><input type="checkbox" name="clientAlertsEnabled" defaultChecked={settings.clientAlertsEnabled} /> Enviar alertas automáticas por correo al cliente al llegar a esos días</label>
            <button type="submit" className="btn btn-sm">Guardar</button>
          </ActionForm>
          <p className="muted small" style={{ marginTop: 14 }}>La fecha y hora límite semanal para solicitar retención se fija en <strong>Consolidados</strong>.</p>
        </Panel>
      )}

      {seccion === 'pkg' && (
        <div className="stack">
          <Panel title="Numeración de PKG" subtitle="El primer PKG usa este número y el sistema sugiere el siguiente disponible. Se puede cambiar a mano; nunca se repiten.">
            <ActionForm action={savePkgNumbering} success="Numeración guardada">
              <div className="form-grid"><Field label="Número inicial de PKG" name="pkgStartNumber" defaultValue={settings.pkgStartNumber} step="1" min="1" hint="Ej. 500 → PKG500, PKG501…" /></div>
              <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Guardar</button>
            </ActionForm>
          </Panel>
          <Panel title="Códigos de cliente" subtitle="Se generan solos: prefijo del país + consecutivo. Un cliente = un código permanente.">
            <ActionForm action={setNextClientNumber} success="Consecutivo actualizado">
              <div className="form-grid"><Field label="Próximo número de cliente" name="nextClientNumber" defaultValue={(clientCounter?.value ?? 0) + 1} step="1" min="1" hint="Útil para continuar la numeración que ya usaba Shop USA." /></div>
              <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Guardar</button>
            </ActionForm>
          </Panel>
        </div>
      )}

      {seccion === 'custodio' && (
        <Panel title="Custodio de paquetería" subtitle="Tarifas por tamaño de paquete y costo del delivery.">
          <ActionForm action={saveCustody} success="Tarifas guardadas">
            <div className="form-grid">
              <Field label="Small ($ por paquete)" name="custodySmallFee" defaultValue={settings.custodySmallFee} />
              <Field label="Medium ($ por paquete)" name="custodyMediumFee" defaultValue={settings.custodyMediumFee} />
              <Field label="Large ($ por paquete)" name="custodyLargeFee" defaultValue={settings.custodyLargeFee} />
              <Field label="Delivery base ($)" name="deliveryBaseFee" defaultValue={settings.deliveryBaseFee} />
              <Field label="Millas incluidas en el delivery base" name="deliveryBaseMiles" defaultValue={settings.deliveryBaseMiles} step="0.5" />
              <Field label="Costo por milla adicional ($)" name="deliveryExtraPerMile" defaultValue={settings.deliveryExtraPerMile} />
            </div>
            <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Guardar</button>
          </ActionForm>
        </Panel>
      )}

      {seccion === 'pagos' && (
        <Panel title="Datos para transferencias" subtitle="Este texto lo ve el cliente en su portal al pagar un pedido o su saldo.">
          <ActionForm action={savePaymentInstructions} success="Datos guardados">
            <div className="input-container">
              <label>Cuentas y datos de pago</label>
              <textarea name="paymentInstructions" className="input-field" rows={7} defaultValue={settings.paymentInstructions ?? ''} placeholder={'Banco: …\nTitular: …\nCuenta: …\nZelle: …'} />
            </div>
            <button type="submit" className="btn btn-sm" style={{ marginTop: 14 }}>Guardar</button>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
