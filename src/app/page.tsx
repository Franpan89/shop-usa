import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import Navbar from "@/components/marketing/Navbar";
import WhatsAppFab from "@/components/marketing/WhatsAppFab";
import Reveal from "@/components/marketing/Reveal";
import RouteMap from "@/components/marketing/RouteMap";
import ShippingEstimator from "@/components/marketing/ShippingEstimator";
import FaqAccordion from "@/components/marketing/FaqAccordion";
import BrandLogo from "@/components/BrandLogo";
import { SITE, whatsappHref } from "@/config/site";

export const metadata: Metadata = {
  title: "Personal Shopper en EE.UU. y Courier a Panamá y Ecuador",
  description:
    "ShopUSA compra por ti en tiendas de Estados Unidos y envía tus paquetes a Panamá y Ecuador. Casillero en Miami, tarifas por libra y portal de cliente con rastreo en tiempo real.",
};

export default function MarketingHomePage() {
  return (
    <div className={styles.page}>
      <Navbar />

      {/* ---------- Hero ---------- */}
      <section className={styles.hero}>
        <div className={styles.grain} />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Personal shopper · Courier internacional</p>
            <h1 className={styles.h1}>
              Compra en Estados Unidos.
              <br />
              <span className={styles.italic}>Recíbelo</span> en Panamá o Ecuador.
            </h1>
            <p className={styles.heroSub}>
              Te damos un casillero en Miami, compramos por ti si lo necesitas, y
              enviamos tus paquetes hasta la puerta de tu casa — con revisión al
              recibir, tarifas claras por libra y un portal donde ves todo en
              tiempo real.
            </p>

            <div className={styles.heroActions}>
              <a
                className={styles.btnPrimary}
                href={whatsappHref("Hola ShopUSA, quiero empezar a enviar paquetes.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Empieza ahora
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a className={styles.btnGhost} href="#como-funciona">
                Ver cómo funciona
              </a>
            </div>

            <div className={styles.heroFacts}>
              <div className={styles.heroFact}>
                <span className={styles.heroFactDot} />
                Casillero gratuito en Miami
              </div>
              <div className={styles.heroFact}>
                <span className={styles.heroFactDot} />
                Envíos a 🇵🇦 Panamá y 🇪🇨 Ecuador
              </div>
              <div className={styles.heroFact}>
                <span className={styles.heroFactDot} />
                Portal de cliente 24/7
              </div>
            </div>
          </div>

          <Reveal className={styles.heroVisual} delay={150}>
            <span className={styles.scriptTag}>envíos ✈</span>
            <RouteMap />
          </Reveal>
        </div>

        <div className={styles.scrollCue}>
          <span>Descubre más</span>
          <span className={styles.scrollCueLine} />
        </div>
      </section>

      {/* ---------- Servicios ---------- */}
      <section id="servicios" className={`${styles.section} ${styles.sectionInk}`}>
        <div className={styles.container}>
          <Reveal>
            <p className={styles.eyebrow}>Nuestros servicios</p>
            <h2 className={styles.h2}>Dos formas de traer lo que quieres a tu puerta</h2>
            <p className={styles.lede}>
              Ya sea que compres tú mismo o prefieras que nosotros lo hagamos por
              ti, tu pedido pasa por el mismo proceso de revisión, empaque y
              envío hasta Panamá o Ecuador.
            </p>
          </Reveal>

          <div className={styles.servicesGrid}>
            <Reveal delay={80} className={styles.serviceCard}>
              <p className={styles.serviceTag}>Personal Shopper</p>
              <h3 className={styles.serviceTitle}>Compramos por ti en EE.UU.</h3>
              <p className={styles.serviceText}>
                Envíanos el link o descríbenos lo que buscas — Amazon, Shein,
                Nike, Sephora, Best Buy, tiendas de repuestos, lo que sea. Lo
                compramos, lo recibimos en tu casillero y lo preparamos para
                envío.
              </p>
              <ul className={styles.serviceList}>
                <li>Cotización antes de comprar, sin sorpresas</li>
                <li>Consolidamos varias compras en una sola caja</li>
                <li>Revisión de producto al recibirlo</li>
              </ul>
              <div className={styles.serviceMeta}>
                <span className={styles.serviceMetaValue}>
                  {SITE.pricing.personalShopperFeeFromPercent}%
                </span>
                <span className={styles.serviceMetaLabel}>
                  comisión desde, sobre el valor de compra
                </span>
              </div>
            </Reveal>

            <Reveal delay={160} className={styles.serviceCard}>
              <p className={styles.serviceTag}>Courier · Panamá y Ecuador</p>
              <h3 className={styles.serviceTitle}>Enviamos lo que ya compraste</h3>
              <p className={styles.serviceText}>
                ¿Ya tienes tu casillero? Compra en cualquier tienda de Estados
                Unidos con esa dirección y nosotros llevamos el paquete hasta tu
                puerta en Panamá o Ecuador.
              </p>
              <ul className={styles.serviceList}>
                <li>Tarifa por libra según tu categoría de envío</li>
                <li>Salidas periódicas hacia ambos países</li>
                <li>Aviso de recibido, en tránsito y entregado</li>
              </ul>
              <div className={styles.serviceMetaGrid}>
                {SITE.countries.map((c) => (
                  <div key={c.name} className={styles.serviceMetaCol}>
                    <span className={styles.serviceMetaValue}>
                      ${c.fromPerLb.toFixed(2)}
                    </span>
                    <span className={styles.serviceMetaLabel}>
                      {c.flag} {c.name}, por libra desde
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Comunidad de WhatsApp ---------- */}
      <section className={styles.community}>
        <Reveal className={styles.communityInner}>
          <div className={styles.communityCopy}>
            <span className={styles.communityIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3C7.03 3 3 7.03 3 12c0 1.66.45 3.22 1.24 4.56L3 21l4.6-1.2A8.94 8.94 0 0 0 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.8 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .6.4.2.5.7 1.6.7 1.8.1.1.1.3 0 .4-.1.2-.1.3-.3.4-.1.2-.3.3-.4.5-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.3-.2.6-.1.2.1 1.5.7 1.8.8.3.1.4.2.5.3.1.2.1.9-.2 1.7-.3.8-1.7 1.5-2.3 1.6-.6.1-1.3.1-2.1-.1a13.6 13.6 0 0 1-5-3.2 13 13 0 0 1-2.4-3.7c-.3-.7-.5-1.4-.5-2 0-.9.4-1.5.6-1.8Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <div>
              <h3 className={styles.communityTitle}>Únete a nuestra comunidad de WhatsApp</h3>
              <p className={styles.communityText}>
                Entérate primero de nuestras promociones, descubre productos
                nuevos y pide directo por chat lo que estás buscando — sin
                esperar a que abramos horario de oficina.
              </p>
              <div className={styles.communityFeatures}>
                <span className={styles.communityFeature}>🎉 Promociones exclusivas</span>
                <span className={styles.communityFeature}>🛍️ Pedidos directos</span>
                <span className={styles.communityFeature}>📢 Novedades al instante</span>
              </div>
            </div>
          </div>

          <a
            className={styles.communityCta}
            href={SITE.whatsappCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Unirme a la comunidad
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section id="como-funciona" className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.container}>
          <Reveal className={styles.stepsHeader}>
            <div>
              <p className={styles.eyebrow}>El proceso</p>
              <h2 className={styles.h2}>De la tienda en EE.UU. a tu puerta</h2>
            </div>
            <p className={styles.lede}>
              Cuatro pasos, el mismo proceso para cada caja, y visibilidad
              completa desde tu portal de cliente en cada etapa.
            </p>
          </Reveal>

          <div className={styles.steps}>
            {[
              {
                n: "01",
                title: "Obtén tu casillero",
                text: "Te registramos y te damos una dirección en Miami para que compres en cualquier tienda de EE.UU.",
              },
              {
                n: "02",
                title: "Compra o pide que compremos",
                text: "Usa tu casillero para tus propias compras, o dinos qué necesitas y lo compramos por ti.",
              },
              {
                n: "03",
                title: "Recibimos y revisamos",
                text: "Cada paquete se recibe, se pesa y se revisa. Si hay una novedad, la registramos con nota y foto.",
              },
              {
                n: "04",
                title: "Enviamos y le avisamos",
                text: "Tu caja sale hacia Panamá o Ecuador y sigues cada estado — recibido, en tránsito, entregado — desde tu portal.",
              },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 90} className={styles.step}>
                <span className={styles.stepNumber}>{step.n}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Precios ---------- */}
      <section id="precios" className={`${styles.section} ${styles.sectionInk}`}>
        <div className={styles.container}>
          <div className={styles.pricingGrid}>
            <Reveal>
              <p className={styles.eyebrow}>Precios sin letra pequeña</p>
              <h2 className={styles.h2}>Sabes lo que pagas antes de enviar</h2>
              <p className={styles.lede}>
                Tu tarifa por libra depende de la categoría de envío asignada a
                tu cuenta. Usa la calculadora para tener una referencia rápida y
                confírmala con tu asesor antes de despachar.
              </p>

              <div className={styles.pricingPoints}>
                <div className={styles.pricingPoint}>
                  <span className={styles.pricingPointIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className={styles.pricingPointTitle}>Categorías a tu medida</p>
                    <p className={styles.pricingPointText}>
                      Tarifas diferenciadas por país y perfil de envío — incluyendo
                      condiciones especiales para migrantes y emprendedores.
                    </p>
                  </div>
                </div>
                <div className={styles.pricingPoint}>
                  <span className={styles.pricingPointIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className={styles.pricingPointTitle}>Saldo siempre visible</p>
                    <p className={styles.pricingPointText}>
                      Cargos, abonos y balance pendiente quedan registrados en tu
                      estado de cuenta dentro del portal.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <ShippingEstimator />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Portal ---------- */}
      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.container}>
          <div className={styles.portalGrid}>
            <Reveal>
              <div className={styles.mockBezel}>
                <div className={styles.mockWindow}>
                  <div className={styles.mockBar}>
                    <span className={styles.mockDot} />
                    <span className={styles.mockDot} />
                    <span className={styles.mockDot} />
                    <span className={styles.mockUrl}>portal.shopusa.com</span>
                  </div>
                  <div className={styles.mockBody}>
                    <p className={styles.mockGreeting}>Hola, Isabel 👋</p>
                    <p className={styles.mockSub}>Aquí está el estado de tus envíos.</p>

                    <div className={styles.mockOrder}>
                      <div>
                        <p className={styles.mockOrderName}>Pedido #A2F91C</p>
                        <p className={styles.mockOrderMeta}>3.2 lb · Ecuador</p>
                      </div>
                      <span className={`${styles.mockBadge} ${styles.mockBadgeTransit}`}>
                        En tránsito
                      </span>
                    </div>
                    <div className={styles.mockOrder}>
                      <div>
                        <p className={styles.mockOrderName}>Pedido #7B10E4</p>
                        <p className={styles.mockOrderMeta}>1.8 lb · Panamá</p>
                      </div>
                      <span className={`${styles.mockBadge} ${styles.mockBadgeDone}`}>
                        Entregado
                      </span>
                    </div>

                    <div className={styles.mockBalance}>
                      <span className={styles.mockBalanceLabel}>Balance pendiente</span>
                      <span className={styles.mockBalanceValue}>$0.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <p className={styles.eyebrow}>Portal de clientes</p>
              <h2 className={styles.h2}>Todo tu envío, en un solo lugar</h2>
              <p className={styles.lede}>
                Nada de preguntar por chat si tu paquete ya llegó. Tu portal
                muestra el estado real de cada pedido y tu cuenta, actualizado
                por nuestro equipo en Miami.
              </p>

              <div className={styles.portalFeatures}>
                <div className={styles.portalFeature}>
                  <span className={styles.checkIcon}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <b>Estado de pedidos</b> — recibido, en tránsito y entregado,
                    con aviso de cualquier novedad.
                  </span>
                </div>
                <div className={styles.portalFeature}>
                  <span className={styles.checkIcon}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <b>Cuentas por pagar</b> — balance, cargos y abonos siempre
                    actualizados.
                  </span>
                </div>
                <div className={styles.portalFeature}>
                  <span className={styles.checkIcon}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <b>Acceso 24/7</b> — desde tu celular o computadora, cuando lo
                    necesites.
                  </span>
                </div>
              </div>

              <Link href="/login" className={styles.btnPrimary}>
                Ingresar al portal
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Por qué elegirnos ---------- */}
      <section className={`${styles.section} ${styles.sectionInkSoft}`}>
        <div className={styles.container}>
          <Reveal>
            <p className={styles.eyebrow}>Por qué ShopUSA</p>
            <h2 className={styles.h2}>Un proceso pensado para tranquilidad, no sorpresas</h2>
          </Reveal>

          <div className={styles.valuesGrid}>
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  </svg>
                ),
                title: "Rastreo en tiempo real",
                text: "Cada cambio de estado de tu pedido queda reflejado al instante en tu portal.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                ),
                title: "Revisión de novedades",
                text: "Si algo llega dañado o incompleto, lo documentamos y lo resolvemos contigo antes de entregarlo.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                ),
                title: "Casillero en Miami",
                text: "Una sola dirección para todas tus compras en tiendas de Estados Unidos.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 7l9-4 9 4-9 4-9-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M3 12l9 4 9-4M3 17l9 4 9-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                ),
                title: "Categorías de envío",
                text: "Tarifas ajustadas a tu perfil: uso general, migrante o emprendedor.",
              },
            ].map((v, i) => (
              <Reveal key={v.title} delay={i * 80} className={styles.valueCard}>
                <div className={styles.valueIcon}>{v.icon}</div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueText}>{v.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="preguntas" className={`${styles.section} ${styles.sectionInk}`}>
        <div className={styles.container}>
          <Reveal>
            <p className={styles.eyebrow}>Preguntas frecuentes</p>
            <h2 className={styles.h2}>Todo lo que preguntan antes de enviar su primera caja</h2>
          </Reveal>
          <Reveal delay={100}>
            <FaqAccordion />
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section id="contacto" className={`${styles.section} ${styles.sectionPaper} ${styles.finalCta}`}>
        <Reveal>
          <p className={styles.eyebrow}>Empieza hoy</p>
          <h2 className={styles.h2}>
            Tu próxima compra en Estados Unidos ya tiene forma de llegar a casa
          </h2>
          <p className={styles.lede} style={{ margin: "0 auto" }}>
            Escríbenos por WhatsApp y te damos tu casillero en Miami el mismo
            día.
          </p>
          <div className={styles.finalActions}>
            <a
              className={styles.btnPrimary}
              href={whatsappHref("Hola ShopUSA, quiero más información sobre el servicio.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escríbenos por WhatsApp
            </a>
            <Link
              href="/login"
              className={styles.btnGhost}
              style={{ borderColor: "var(--mkt-line-on-paper)", color: "var(--mkt-ink)" }}
            >
              Ya soy cliente — Portal
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div>
              <p className={styles.footerBrand}>
                <BrandLogo height={34} />
              </p>
              <p className={styles.footerTagline}>
                Personal shopper y courier internacional para quienes compran en
                Estados Unidos y viven en Panamá o Ecuador.
              </p>
            </div>
            <div className={styles.footerCol}>
              <h4>Servicios</h4>
              <a href="#servicios">Personal shopper</a>
              <a href="#servicios">Courier a Panamá</a>
              <a href="#servicios">Courier a Ecuador</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Compañía</h4>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#precios">Precios</a>
              <a href="#preguntas">Preguntas frecuentes</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Contacto</h4>
              <a href={whatsappHref("Hola ShopUSA, tengo una pregunta.")} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a href={SITE.whatsappCommunityUrl} target="_blank" rel="noopener noreferrer">
                Comunidad de WhatsApp
              </a>
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              <Link href="/login">Portal de clientes</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} {SITE.brand}. Todos los derechos reservados.</span>
            <span>Miami, FL · Envíos a Panamá y Ecuador</span>
          </div>
        </div>
      </footer>

      <WhatsAppFab />
    </div>
  );
}
