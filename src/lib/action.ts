import 'server-only';

/**
 * En producción Next.js oculta el mensaje de los errores lanzados desde una Server Action
 * ("An error occurred in the Server Components render…"). Para que el personal vea el motivo
 * real (saldo pendiente, falta foto, etc.) las acciones devuelven un resultado tipado en vez
 * de lanzar, y el cliente decide cómo mostrarlo.
 */
export type ActionResult<R extends object = object> = ({ ok: true } & R) | { ok: false; error: string };

/** redirect(), notFound() y similares funcionan lanzando: no deben convertirse en resultado. */
function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') || digest === 'NEXT_NOT_FOUND';
}

export function safe<A extends unknown[], R extends object | void>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<ActionResult<R extends object ? R : object>> {
  return async (...args: A) => {
    try {
      const result = await fn(...args);
      return { ok: true, ...((result ?? {}) as object) } as ActionResult<R extends object ? R : object>;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;
      // Los errores propios (new Error('…')) ya traen un mensaje pensado para el usuario;
      // los de Prisma/driver son técnicos y no se exponen.
      const technical = error instanceof Error && /^PrismaClient|DriverAdapter/.test(error.constructor.name);
      // Solo se registran los fallos inesperados; las reglas de negocio rechazadas son flujo normal.
      if (technical || !(error instanceof Error)) console.error('[action]', error);
      return {
        ok: false,
        error: technical ? 'No se pudo completar la operación. Intenta de nuevo.' : error instanceof Error ? error.message : 'Error inesperado',
      };
    }
  };
}
