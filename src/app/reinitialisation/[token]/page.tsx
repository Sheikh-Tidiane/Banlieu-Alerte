import type { Metadata } from 'next';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { findValidPasswordReset } from '@/services/invitations/invitations';

export const metadata: Metadata = {
  title: translate('invitation.resetTitle'),
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export default async function PasswordResetPage({ params }: Props) {
  const { token } = await params;
  const reset = await findValidPasswordReset(token);

  if (!reset) {
    return (
      <PageShell className="max-w-xl">
        <EmptyState
          title={translate('invitation.invalidTitle')}
          body={translate('invitation.invalidLead')}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('invitation.resetTitle')}</h1>
        <p className="text-muted">{translate('invitation.resetLead')}</p>
      </div>
      <Card>
        <SetPasswordForm mode="reset" token={token} />
      </Card>
    </PageShell>
  );
}
