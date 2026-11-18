import BrandLogo from '@/components/BrandLogo';
import type { LabelData } from '@/lib/guides';
import Barcode128 from './Barcode128';
import styles from './GuideLabel.module.css';

/** Una etiqueta de guía 4x6 (impresora térmica). Componente de servidor, sin estado. */
export default function GuideLabel({ label }: { label: LabelData }) {
  const weight = label.weightLb != null ? `${label.weightEstimated ? '~' : ''}${label.weightLb.toFixed(2)} lb` : '—';

  return (
    <section className={styles.label} data-guide={label.code}>
      <header className={styles.head}>
        <div className={styles.logo}>
          <BrandLogo height={40} />
        </div>
        <div className={styles.tag}>({label.countryTag})</div>
      </header>

      {label.retained && <div className={styles.banner}>RETENIDA EN BODEGA · NO DESPACHAR</div>}

      <div className={styles.block}>
        <div className={styles.cap}>REMITENTE</div>
        <div className={styles.big}>{label.senderName}</div>
        {label.senderLines.map((l) => (
          <div key={l} className={styles.line}>{l}</div>
        ))}
      </div>

      <div className={`${styles.block} ${styles.grow}`}>
        <div className={styles.cap}>{label.toTitle}</div>
        <div className={styles.big}>{label.toName}</div>
        {label.toLines.map((l) => (
          <div key={l} className={`${styles.line} ${styles.clamp}`}>{l}</div>
        ))}
      </div>

      <div className={`${styles.block} ${styles.meta}`}>
        <span className={styles.mono}>{label.series === 'IFL' ? 'WAREHOUSE' : 'CAJA PKG'}</span>
        <span>DATE: {label.date}</span>
      </div>

      <div className={styles.barcode}>
        <Barcode128 value={label.code} />
        <div className={styles.codeText}>{label.code}</div>
      </div>

      <div className={styles.block}>
        <div className={styles.cap}>DESTINATION</div>
        <div className={styles.big}>{label.destination}</div>
      </div>

      <div className={styles.foot}>
        <div className={styles.footL}>
          <div className={styles.cap}>WEIGHT</div>
          <div className={styles.val}>{weight}</div>
          <div className={styles.small}>PIEZAS: {label.pieces}</div>
        </div>
        <div className={styles.footR}>
          <div className={styles.cap}>DESCRIPTION</div>
          <div className={styles.desc}>{label.description || '—'}</div>
          {label.declaredValue != null && <div className={styles.small}>VALOR DECLARADO: USD {label.declaredValue.toFixed(2)}</div>}
        </div>
      </div>
    </section>
  );
}
