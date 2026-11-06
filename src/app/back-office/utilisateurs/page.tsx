import type { Metadata } from 'next';
import { AccountRow, InviteForm, RevokeButton } from '@/components/backoffice/user-management';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { requirePageUser } from '@/permissions/require';
import { listZoneOptions } from '@/services/backoffice/zones';
import { listAccounts, listPendingInvitations } from '@/services/invitations/invitations';

export const metadata: Metadata = { title: translate('backoffice.users.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function UsersPage() {
  const admin = await requirePageUser('/back-office/utilisateurs', ['ADMIN']);
  const [invitations, accounts, { communes, neighborhoods }] = await Promise.all([
    listPendingInvitations(admin),
    listAccounts(admin),
    listZoneOptions(),
  ]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">{translate('backoffice.users.title')}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <CardTitle>{translate('backoffice.users.inviteTitle')}</CardTitle>
            <CardDescription>{translate('backoffice.users.inviteLead')}</CardDescription>
          </div>
          <InviteForm communes={communes} neighborhoods={neighborhoods} />
        </Card>

        <section aria-labelledby="pending" className="space-y-3">
          <h3 id="pending" className="text-xl font-semibold">
            {translate('backoffice.users.pending')}
          </h3>
          {invitations.length === 0 ? (
            <EmptyState title={translate('backoffice.users.pendingEmpty')} />
          ) : (
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="rounded-card border-line bg-surface-raised flex flex-wrap items-center justify-between gap-2 border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-all">{invitation.email}</p>
                    <p className="text-muted text-sm">
                      <Badge tone="primary" className="mr-1">
                        {translate(`roles.${invitation.role}`)}
                      </Badge>
                      {invitation.scopeNeighborhood?.name ?? invitation.scopeCommune?.name ?? ''} ·{' '}
                      {translate('backoffice.users.expires')}{' '}
                      {dateFormatter.format(invitation.expiresAt)}
                    </p>
                  </div>
                  <RevokeButton invitationId={invitation.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="accounts" className="space-y-3">
        <h3 id="accounts" className="text-xl font-semibold">
          {translate('backoffice.users.accounts')}
        </h3>
        <ul className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              isSelf={account.id === admin.id}
              account={{
                id: account.id,
                name: account.name,
                email: account.email,
                role: account.role,
                status: account.status,
                isDemo: account.isDemo,
                scope:
                  account.delegatedNeighborhood.map((n) => n.name).join(', ') ||
                  account.commune?.name ||
                  null,
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
