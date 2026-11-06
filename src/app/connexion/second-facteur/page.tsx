import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { SecondFactorForm } from '@/components/auth/second-factor-form';
import { safeNextPath } from '@/components/auth/auth-form';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { translate } from '@/i18n';
import { getCurrentUser } from '@/lib/auth/session';
import { startEnrollment } from '@/services/auth/mfa';

export const metadata: Metadata = { title: translate('mfa.title'), robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ suite?: string }> };

/** Second facteur de l'administrateur (EXG-41) : enrôlement ou vérification. */
export default async function SecondFactorPage({ searchParams }: Props) {
  const { suite } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(suite ?? '/back-office')}`);
  if (user.role !== 'ADMIN') redirect('/mon-espace');
  if (user.mfaVerified) redirect(safeNextPath(suite ?? '/back-office') as '/back-office');

  const enrollment = user.mfaEnrolled ? null : await startEnrollment(user);

  return (
    <PageShell className="max-w-md space-y-6">
      <h1 className="text-3xl font-bold">
        {translate(enrollment ? 'mfa.enrollTitle' : 'mfa.title')}
      </h1>
      <Card className="space-y-4">
        {enrollment ? (
          <>
            <p>{translate('mfa.enrollLead')}</p>
            <Image
              src={enrollment.qrCode}
              alt={translate('mfa.qrAlt')}
              width={240}
              height={240}
              unoptimized
              className="mx-auto"
            />
            <div>
              <p className="text-muted text-sm">{translate('mfa.manualKey')}</p>
              <p className="font-mono text-sm break-all" data-testid="manual-key">
                {enrollment.manualKey}
              </p>
            </div>
            <SecondFactorForm mode="enroll" next={suite} />
          </>
        ) : (
          <>
            <p>{translate('mfa.verifyLead')}</p>
            <SecondFactorForm mode="verify" next={suite} />
          </>
        )}
      </Card>
    </PageShell>
  );
}
