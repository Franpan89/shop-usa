import Image from 'next/image';
import type { LabelData } from '@/lib/guides';
import Barcode128 from './Barcode128';
import styles from './GuideLabel.module.css';

/** Logo de las guías (las IFLWH salen todas con la marca IFL Courier). 210 x 116 px. */
const LOGO = { src: '/brand/ifl-courier.png', width: 210, height: 116 };

/** Con nombres o direcciones muy largos la etiqueta usa letra más chica para que todo quepa. */
function isDense(l: LabelData): boolean {
  return (
    l.retained ||
    l.senderName.length > 36 ||
    l.toName.length > 34 ||
    l.destination.length > 30 ||
    l.senderLines.join(' ').length > 70 ||
    l.toLines.join(' ').length > 100 ||
    l.description.length > 95
  );
}

/**
 * Una etiqueta de guía 4x6 (impresora térmica). Componente de servidor, sin estado.
 * De arriba abajo: marca y país · código de barras · remitente · destinatario y destino ·
 * peso, piezas y tracking (PKG / identificador) · descripción · fecha y valor.
 */
export default function GuideLabel({ label }: { label: LabelData }) {
  const weight = label.weightLb != null ? `${label.weightEstimated ? '~' : ''}${label.weightLb.toFixed(2)}` : '—';

  return (
    <section className={`${styles.label} ${isDense(label) ? styles.dense : ''}`} data-guide={label.code}>
      <header className={styles.head}>
        <Image className={styles.logo} src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="IFL Courier" unoptimized priority />
        <div className={styles.tag}>({label.countryTag})</div>
      </header>

      {label.retained && <div className={styles.banner}>RETENIDA EN BODEGA · NO DESPACHAR</div>}

      <div className={styles.barcode}>
        <div className={styles.bars}>
          <Barcode128 value={label.code} fill />
        </div>
        <div className={styles.codeText}>{label.code}</div>
      </div>

      <div className={`${styles.block} ${styles.sender}`}>
        <div className={styles.cap}>REMITENTE</div>
        <div className={`${styles.name} ${styles.clamp1}`}>{label.senderName}</div>
        {label.senderLines.map((l) => (
          <div key={l} className={`${styles.line} ${styles.clamp1}`}>{l}</div>
        ))}
      </div>

      <div className={`${styles.block} ${styles.dest}`}>
        <div className={styles.cap}>{label.toTitle}</div>
        <div className={`${styles.name} ${styles.nameTo} ${styles.clamp2}`}>{label.toName}</div>
        <div className={styles.toLines}>
          {label.toLines.map((l) => (
            <div key={l} className={`${styles.line} ${styles.clamp2}`}>{l}</div>
          ))}
        </div>
        <div className={styles.destination}>
          <span className={styles.cap}>DESTINATION</span>
          <span className={`${styles.place} ${styles.clamp2}`}>{label.destination}</span>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.cell}>
          <div className={styles.cap}>WEIGHT</div>
          <div className={styles.val}>{weight}<span className={styles.unit}> lb</span></div>
        </div>
        <div className={styles.cell}>
          <div className={styles.cap}>PIEZAS</div>
          <div className={styles.val}>{label.pieces}</div>
        </div>
        <div className={`${styles.cell} ${styles.cellWide}`}>
          <div className={styles.cap}>TRACKING</div>
          <div className={`${styles.val} ${styles.mono}`}>{label.refCode ?? '—'}</div>
        </div>
      </div>

      <div className={styles.descBlock}>
        <div className={styles.cap}>DESCRIPTION</div>
        <div className={styles.desc}>{label.description || '—'}</div>
      </div>

      <footer className={styles.strip}>
        <span>{label.series === 'IFL' ? 'WAREHOUSE' : 'CAJA PKG'} · {label.date}</span>
        {label.declaredValue != null && <span>VALOR DECL. USD {label.declaredValue.toFixed(2)}</span>}
      </footer>
    </section>
  );
}
