import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateAlertForm } from '@/components/backoffice/alert-editor';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { translate } from '@/i18n';
import { dakarInputInHours } from '@/lib/utils/dakar-time';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { listAlertableNeighborhoods } from '@/services/alerts/read';

export const metadata: Metadata = { title: translate('backoffice.alerts.new') };

export default async function NewAlertPage() {
  const user = await requirePageUser('/back-office/alertes/nouvelle', STAFF_ROLES);
  const neighborhoods = await listAlertableNeighborhoods(user);
  // Officielle : agents et administrateurs seulement (D-049).
  const allowedTypes =
    user.role === 'DELEGATE' ? (['INDICATIVE'] as const) : (['INDICATIVE', 'OFFICIAL'] as const);

  return (
    <div className="space-y-5">
      <Link href="/back-office/alertes" className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeft aria-hidden="true" />
        {translate('backoffice.alerts.back')}
      </Link>
      <h2 className="text-2xl font-semibold">{translate('backoffice.alerts.new')}</h2>
      <Card className="max-w-3xl">
        <CreateAlertForm
          neighborhoods={neighborhoods}
          allowedTypes={[...allowedTypes]}
          initial={{
            type: 'INDICATIVE',
            level: 'MODERATE',
            issuerName: '',
            title: '',
            messageFr: '',
            messageWo: '',
            woReviewed: false,
            advice: translate('alertTemplate.advice'),
            neighborhoodIds: neighborhoods.length === 1 ? [neighborhoods[0]!.id] : [],
            validUntil: dakarInputInHours(24),
            scheduledAt: '',
          }}
        />
      </Card>
    </div>
  );
}
