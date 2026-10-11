/** Sesión simulada para probar las acciones del servidor fuera de Next (solo pruebas). */
export type E2EUser = { kind: 'staff'; id: string; name: string; email: string; role: 'ADMIN' | 'SUBADMIN' };

const g = globalThis as unknown as { __e2ePortal?: { kind: 'portal'; id: string; name: string; email: string } };
const staff: E2EUser = { kind: 'staff', id: 'e2e', name: 'E2E Tester', email: 'e2e@test.local', role: 'ADMIN' };

export async function getCurrentUser() {
  return g.__e2ePortal ?? staff;
}
export async function requireUser() {
  return g.__e2ePortal ?? staff;
}
export async function requireStaff() {
  return staff;
}
export async function requireAdmin() {
  return staff;
}
export async function requirePortalClient() {
  if (!g.__e2ePortal) throw new Error('No hay cliente de portal simulado');
  return g.__e2ePortal;
}
