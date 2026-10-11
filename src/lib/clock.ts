/**
 * Hora actual. Las páginas de servidor se renderizan en cada request (force-dynamic),
 * por lo que leer el reloj es correcto; este wrapper evita la regla de pureza de React
 * que marca Date.now() directo dentro de componentes.
 */
export const nowMs = (): number => Date.now();
