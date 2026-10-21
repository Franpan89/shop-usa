/** Reglas puras del acceso de clientes al portal (sin base de datos, para poder probarlas). */
import { formatClientCode } from './pricing';

/**
 * Lleva lo que escribe el cliente al código canónico: "ec1", "EC 001" y "EC00001" → "EC001".
 * Devuelve null si no tiene forma de código (letras del país + número).
 */
export function normalizeClientCode(input: string): string | null {
  const m = input.trim().match(/^([a-zA-Z]{2,4})[\s-]*0*(\d{1,7})$/);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  return n > 0 ? formatClientCode(m[1], n) : null;
}

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * ¿Es el mismo teléfono aunque venga escrito distinto? ("+593-99-582-9642" vs "0995829642").
 * Compara los últimos 9 dígitos, que es el número nacional móvil de Ecuador; el prefijo del país no cuenta.
 */
export function phonesMatch(a: string, b: string): boolean {
  const x = digits(a);
  const y = digits(b);
  if (x.length < 7 || y.length < 7) return false;
  const len = Math.min(9, x.length, y.length);
  return x.slice(-len) === y.slice(-len);
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
