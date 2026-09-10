import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import NewUserForm from './NewUserForm';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  await requireAdmin();

  const tenant = await prisma.tenant.findFirst();
  const users = tenant
    ? await prisma.user.findMany({ where: { tenantId: tenant.id }, orderBy: { name: 'asc' } })
    : [];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Cuentas del equipo interno y sus roles.</p>
        </div>
        <NewUserForm />
      </header>

      <div className="glass-panel" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th>CORREO</th>
              <th>ROL</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'ADMIN' ? 'badge-warning' : 'badge-info'}`}>
                    {u.role === 'ADMIN' ? 'Admin' : 'Sub-admin'}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay usuarios registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
