/**
 * Modo demo: una instancia aparte (su propio Supabase y su propio Vercel) con datos ficticios, pensada
 * para mostrar el sistema a posibles clientes. Se activa con DEMO_MODE=true; en producción no existe.
 */
export const isDemo = () => process.env.DEMO_MODE === 'true';

/** Cuentas de acceso rápido del demo. La contraseña sale de DEMO_PASSWORD (nunca se escribe en el código). */
export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@demo-courier.com', name: 'Administrador Demo', label: 'Administrador', hint: 'Panel completo: clientes, pedidos, pagos, configuraciones' },
  staff: { email: 'equipo@demo-courier.com', name: 'Operador Demo', label: 'Equipo (subadmin)', hint: 'Operación diaria, sin configuraciones ni usuarios' },
  client: { email: 'maria.salazar@demo-courier.com', name: 'María Fernanda Salazar', label: 'Cliente', hint: 'Portal del cliente: pedidos, mercancía y estado de cuenta' },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;
