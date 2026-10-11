import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/tenant';
import { retentionDays, retentionLevel } from '@/lib/domain/flow';
import { sendRetentionAlertEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * Alertas automáticas al cliente por retención prolongada (3.18). Se ejecuta a diario
 * con Vercel Cron (ver vercel.json). Cada nivel se avisa una sola vez por consolidado.
 * Protegido con CRON_SECRET: Vercel lo envía como "Authorization: Bearer <secret>".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.clientAlertsEnabled) return NextResponse.json({ sent: 0, disabled: true });

  const held = await prisma.consolidation.findMany({
    where: { status: 'OPEN', decision: 'HOLD', retentionStartedAt: { not: null } },
    include: { client: { select: { name: true, email: true } } },
  });

  let sent = 0;
  for (const c of held) {
    const days = retentionDays(c.retentionStartedAt);
    const level = retentionLevel(days, true, settings.retentionWarningDays, settings.retentionMaxDays);
    if (level !== 'warning' && level !== 'overdue') continue;

    const alreadySent = level === 'overdue' ? c.maxAlertSentAt : c.warningAlertSentAt;
    if (alreadySent || !c.client.email) continue;

    await sendRetentionAlertEmail({
      to: c.client.email,
      clientName: c.client.name,
      days,
      maxDays: settings.retentionMaxDays,
      level,
    });
    await prisma.consolidation.update({
      where: { id: c.id },
      data: level === 'overdue' ? { maxAlertSentAt: new Date(), warningAlertSentAt: c.warningAlertSentAt ?? new Date() } : { warningAlertSentAt: new Date() },
    });
    sent++;
  }

  return NextResponse.json({ checked: held.length, sent });
}
