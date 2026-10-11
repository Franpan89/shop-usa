import { requireStaff } from '@/lib/auth';
import { getNavCounts } from '@/lib/navCounts';
import Sidebar from '@/components/Sidebar';
import BgBlobs from '@/components/BgBlobs';
import Toaster from '@/components/ui/Toast';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const counts = await getNavCounts();

  return (
    <div className="app-layout">
      <BgBlobs />
      <Sidebar role={user.role} userName={user.name} counts={counts} />
      <main className="main-content">
        <div className="glass-container">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
