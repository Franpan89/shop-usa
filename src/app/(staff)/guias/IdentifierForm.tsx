'use client';

import ActionForm from '@/components/ui/ActionForm';
import { createGuideIdentifier } from '@/app/actions/guides';

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '');

/**
 * Alta de un identificador adicional a PKG (JM, ABC…). Cada identificador lleva su propia
 * secuencia: JM001, JM002… La numeración de la guía (IFLWH) no depende de él.
 */
export default function IdentifierForm({ onSaved }: { onSaved?: (result: Record<string, unknown>) => void }) {
  return (
    <ActionForm
      action={(fd) => createGuideIdentifier({ prefix: str(fd, 'prefix'), description: str(fd, 'description'), startAt: str(fd, 'startAt') })}
      success="Identificador creado"
      resetOnSuccess
      onSuccess={onSaved}
    >
      <div className="form-grid">
        <div className="input-container">
          <label>Identificador</label>
          <input name="prefix" className="input-field" required maxLength={6} placeholder="JM" autoComplete="off" style={{ textTransform: 'uppercase' }} />
          <span className="input-hint">2 a 6 letras o números, empieza con letra. PKG ya existe.</span>
        </div>
        <div className="input-container">
          <label>Descripción</label>
          <input name="description" className="input-field" placeholder="Opcional: a quién corresponde" autoComplete="off" />
        </div>
        <div className="input-container">
          <label>Primer número</label>
          <input name="startAt" type="number" min={1} max={99999} step={1} className="input-field" defaultValue={1} />
          <span className="input-hint">1 = JM001. Cámbialo solo si ya venías usando ese identificador.</span>
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button type="submit" className="btn">Guardar identificador</button>
      </div>
    </ActionForm>
  );
}
