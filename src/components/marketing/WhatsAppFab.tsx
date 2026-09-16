import styles from "./WhatsAppFab.module.css";
import { whatsappHref } from "@/config/site";

export default function WhatsAppFab() {
  return (
    <a
      className={styles.fab}
      href={whatsappHref("Hola ShopUSA, quiero cotizar un envío ✈️")}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <span className={styles.label}>Escríbenos</span>
    </a>
  );
}
