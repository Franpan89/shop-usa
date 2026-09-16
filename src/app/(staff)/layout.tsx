import { requireStaff } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import BgBlobs from '@/components/BgBlobs';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="app-layout">
      <BgBlobs />
      <Sidebar role={user.role} userName={user.name} />
      <main className="main-content">
        <div className="glass-container">
          {children}
        </div>
      </main>
    </div>
  );
}
