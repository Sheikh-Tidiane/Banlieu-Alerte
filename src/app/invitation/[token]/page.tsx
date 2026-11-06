import type { Metadata } from 'next';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { findValidInvitation } from '@/services/invitations/invitations';

export const metadata: Metadata = {
  title: translate('invitation.title'),
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  if (!invitation) {
    return (
      <PageShell className="max-w-xl">
        <EmptyState
          title={translate('invitation.invalidTitle')}
          body={translate('invitation.invalidLead')}
        />
      </PageShell>
    );
  }

  const scope = invitation.scopeNeighborhood?.name ?? invitation.scopeCommune?.name;
  return (
    <PageShell className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('invitation.title')}</h1>
        <p className="text-muted">{translate('invitation.lead')}</p>
      </div>
      <Card className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{translate('auth.email')}</dt>
          <dd className="font-medium break-all">{invitation.email}</dd>
          <dt className="text-muted">{translate('invitation.role')}</dt>
          <dd className="font-medium">
            {translate(`roles.${invitation.role}`)}
            {scope ? ` · ${scope}` : ''}
          </dd>
        </dl>
        <SetPasswordForm mode="invitation" token={token} />
      </Card>
    </PageShell>
  );
}
