import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveNotificationMode } from '@/lib/notifications';
import { listPublicNeighborhoods } from '@/services/geo/neighborhoods';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: translate('subscribe.title') };

export default async function SubscribePage() {
  const user = await getCurrentUser();
  const simulated = resolveNotificationMode() === 'simulation';

  return (
    <PageShell className="max-w-2xl space-y-6">
      <h1 className="text-primary text-3xl font-bold">{translate('subscribe.title')}</h1>
      <p className="text-muted text-lg">{translate('subscribe.intro')}</p>
      {simulated && <StateBanner kind="info" title={translate('notifications.simulationMode')} />}
      {user ? (
        <Card>
          <SubscriptionForm
            neighborhoods={await listPublicNeighborhoods()}
            webPushSimulated={simulated}
          />
        </Card>
      ) : (
        <Card className="space-y-4">
          <p className="font-semibold">{translate('subscribe.needAccount')}</p>
          <p className="text-muted">{translate('subscribe.needAccountBody')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/connexion?suite=%2Fs-abonner" className={buttonVariants()}>
              {translate('subscribe.login')}
            </Link>
            <Link href="/inscription" className={buttonVariants({ variant: 'outline' })}>
              {translate('subscribe.register')}
            </Link>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
