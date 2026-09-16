"use client";

import { useMemo, useState } from "react";
import styles from "./ShippingEstimator.module.css";
import { SITE, whatsappHref } from "@/config/site";

const MIN_LB = 1;
const MAX_LB = 25;

export default function ShippingEstimator() {
  const [weight, setWeight] = useState(5);
  const [countryName, setCountryName] = useState<string>(SITE.countries[0].name);
  const country = SITE.countries.find((c) => c.name === countryName) ?? SITE.countries[0];

  const estimate = useMemo(
    () => weight * country.fromPerLb,
    [weight, country]
  );

  const fillPercent = ((weight - MIN_LB) / (MAX_LB - MIN_LB)) * 100;

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Calculadora rápida</p>
      <h3 className={styles.title}>¿Cuánto cuesta enviar tu paquete?</h3>

      <div className={styles.row}>
        <div className={styles.sliderWrap}>
          <div className={styles.sliderTop}>
            <span>Peso estimado</span>
            <span className={styles.weightValue}>{weight} lb</span>
          </div>
          <input
            className={styles.slider}
            style={{ ["--fill" as string]: `${fillPercent}%` }}
            type="range"
            min={MIN_LB}
            max={MAX_LB}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            aria-label="Peso del paquete en libras"
          />
        </div>

        <div className={styles.countryPicker}>
          {SITE.countries.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`${styles.countryBtn} ${countryName === c.name ? styles.countryBtnActive : ""}`}
              onClick={() => setCountryName(c.name)}
            >
              {c.flag} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.result}>
        <div>
          <p className={styles.resultLabel}>Envío estimado a {country.name}, desde</p>
          <p className={styles.resultValue}>
            ${estimate.toFixed(2)} <span>USD</span>
          </p>
        </div>
        <a
          className={styles.ctaLink}
          href={whatsappHref(
            `Hola ShopUSA, quiero cotizar un envío de ${weight} lb a ${country.name}.`
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Confirmar por WhatsApp →
        </a>
      </div>

      <p className={styles.disclaimer}>
        Estimado referencial a ${country.fromPerLb.toFixed(2)}/lb para {country.name}.
        La tarifa final depende de la categoría de envío asignada a tu cuenta y
        se confirma antes de despachar tu caja.
      </p>
    </div>
  );
}
