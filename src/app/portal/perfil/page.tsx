import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import EditProfileForm from './EditProfileForm';

export const dynamic = 'force-dynamic';

export default async function PortalPerfilPage() {
  const currentClient = await requirePortalClient();
  const client = await prisma.client.findUnique({ where: { id: currentClient.id } });
  if (!client) return null;

  return (
    <div style={{ padding: '32px' }}>
      <h1 className="page-title" style={{ marginBottom: '4px' }}>Mi Perfil</h1>
      <p className="page-subtitle" style={{ marginBottom: '24px' }}>
        Puedes actualizar tu teléfono y preferencia de entrega. Para otros cambios, contacta a ShopUSA.
      </p>
      <div className="glass-panel" style={{ padding: '32px' }}>
        <EditProfileForm client={{ phone: client.phone, deliveryMethod: client.deliveryMethod, deliveryAddress: client.deliveryAddress }} />
      </div>
    </div>
  );
}
