"use client";

import { useState } from "react";
import styles from "./FaqAccordion.module.css";

const FAQS = [
  {
    q: "¿Qué puedo comprar y enviar?",
    a: "Prácticamente cualquier producto legal de tiendas de Estados Unidos: ropa, tecnología, belleza, suplementos, repuestos, artículos para el hogar. Si tienes dudas sobre un producto puntual, pregúntanos antes de comprar.",
  },
  {
    q: "¿Cómo pago mi personal shopper o mi envío?",
    a: "Coordinamos el pago contigo antes de comprar o despachar. Todo tu historial de cargos, abonos y saldo pendiente queda registrado en tu portal de cliente, sin necesidad de perseguir comprobantes por chat.",
  },
  {
    q: "¿Cuánto tarda en llegar mi paquete?",
    a: "El tiempo de tránsito varía según el volumen de la caja y el proceso aduanal de cada país. Te avisamos en cada etapa —recibido, en tránsito, entregado— desde tu portal, para que nunca estés adivinando dónde está tu pedido.",
  },
  {
    q: "¿Qué pasa si algo llega dañado o incompleto?",
    a: "Cada caja se revisa al recibirla. Si encontramos una novedad (daño, faltante, etc.) la registramos con nota y evidencia en tu cuenta, y la resolvemos contigo directamente antes de darla por entregada.",
  },
  {
    q: "¿Tienen tarifas distintas por tipo de cliente?",
    a: "Sí. Además de la tarifa general, manejamos categorías de envío con condiciones especiales (por ejemplo, para migrantes o emprendedores). Tu asesor te ubica en la que mejor se ajuste a tu volumen de envío.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={styles.list}>
      {FAQS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q} className={`${styles.item} ${isOpen ? styles.itemOpen : ""}`}>
            <button
              className={styles.question}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              {item.q}
              <span className={styles.icon} aria-hidden="true" />
            </button>
            <div className={styles.answerWrap}>
              <div className={styles.answerInner}>
                <p className={styles.answer}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
