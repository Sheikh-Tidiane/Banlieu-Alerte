import type { Metadata } from 'next';
import { ZoneManager } from '@/components/backoffice/zone-manager';
import { translate } from '@/i18n';
import { requirePageUser } from '@/permissions/require';
import { listZones } from '@/services/backoffice/zones';

export const metadata: Metadata = { title: translate('backoffice.zones.title') };

export default async function ZonesPage() {
  const admin = await requirePageUser('/back-office/zones', ['ADMIN']);
  const { communes, delegates } = await listZones(admin);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('backoffice.zones.title')}</h2>
        <p className="text-muted max-w-3xl">{translate('backoffice.zones.lead')}</p>
      </div>
      <ZoneManager communes={communes} delegates={delegates} />
    </div>
  );
}
