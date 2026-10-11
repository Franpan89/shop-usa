import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getNavCounts } from '@/lib/navCounts';
import { getSettings } from '@/lib/tenant';
import { nowMs } from '@/lib/clock';
import Sidebar from '@/components/Sidebar';
import Toaster from '@/components/ui/Toast';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [counts, settings] = await Promise.all([getNavCounts(), getSettings()]);
  const cutoff = settings.dispatchCutoffAt;
  const passed = cutoff ? cutoff.getTime() < nowMs() : false;

  return (
    <div className="app-shell">
      {/* Barra de anuncio: el dato que más importa en la semana */}
      <div className="announce">
        {!cutoff ? (
          <>Define la fecha límite semanal para que los clientes soliciten retención.</>
        ) : passed ? (
          <>El cierre semanal <strong>ya pasó</strong>: cierra y factura los consolidados.</>
        ) : (
          <>
            Cierre semanal: los clientes pueden retener su mercancía hasta el{' '}
            <strong>{cutoff.toLocaleString('es-ES', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
          </>
        )}
        <Link href="/consolidados">{cutoff && !passed ? 'Ver consolidados →' : 'Ir a Consolidados →'}</Link>
      </div>
      <div className="app-layout">
        <Sidebar role={user.role} userName={user.name} counts={counts} />
        <main className="main-content">
          <div className="glass-container">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
