import { BellRing, LayoutDashboard, Megaphone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyActions, ProfileForm } from '@/components/account/account-settings';
import { PageShell } from '@/components/layout/page-shell';
import { AlertCard } from '@/components/alerts/alert-card';
import { FeedbackPromptCard } from '@/components/episodes/episode-forms';
import { ResolutionQuestion } from '@/components/reports/resolution-question';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import {
  DeleteSubscriptionButton,
  MarkNotificationsReadButton,
} from '@/components/subscriptions/subscription-actions';
import { Badge, DemoBadge, StatusBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { isStaff } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { resolveNotificationMode } from '@/lib/notifications';
import { levelLabel } from '@/lib/risk/explain';
import { listMyReports } from '@/services/account/account';
import { getPrisma } from '@/lib/db';
import { listMyUserNotifications } from '@/services/notifications/user-notifications';
import { listPendingResolutionChecks } from '@/services/reports/feedback';
import { listMyFeedbackPrompts } from '@/services/episodes/episodes';
import { listMyNotifications, listMySubscriptions } from '@/services/subscriptions/subscriptions';

export const metadata: Metadata = { title: translate('account.title'), robots: { index: false } };
export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' });

export default async function AccountPage() {
  const user = await requirePageUser('/mon-espace');
  const [reports, subscriptions, notifications, followup, pendingChecks, preferences, prompts] =
    await Promise.all([
      listMyReports(user),
      listMySubscriptions(user),
      listMyNotifications(user),
      listMyUserNotifications(user),
      listPendingResolutionChecks(user),
      getPrisma().user.findUniqueOrThrow({
        where: { id: user.id },
        select: { notifyStatusChanges: true },
      }),
      listMyFeedbackPrompts(user),
    ]);
  const unreadFollowup = followup.filter((n) => !n.read).length;
  const simulated = resolveNotificationMode() === 'simulation';
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <PageShell className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{translate('account.title')}</h1>
          <p className="text-muted">
            {user.name} · <Badge tone="primary">{translate(`roles.${user.role}`)}</Badge>
          </p>
        </div>
        {isStaff(user) ? (
          <Link href="/back-office" className={buttonVariants({ variant: 'outline' })}>
            <LayoutDashboard aria-hidden="true" />
            {translate('auth.backoffice')}
          </Link>
        ) : (
          <Link href="/signaler" className={buttonVariants()}>
            <Megaphone aria-hidden="true" />
            {translate('homePage.cta')}
          </Link>
        )}
      </div>

      <section aria-labelledby="my-reports" className="space-y-3">
        <h2 id="my-reports" className="text-2xl font-semibold">
          {translate('account.myReports')}
        </h2>
        {reports.length === 0 ? (
          <EmptyState title={translate('account.myReportsEmpty')} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {reports.map((report) => (
              <li key={report.trackingCode}>
                <Link
                  href={`/signalements/${report.trackingCode}`}
                  className="rounded-card border-line bg-surface-raised hover:border-primary flex h-full gap-3 border p-4"
                >
                  <ReportTypeIcon type={report.type} className="text-water size-6 shrink-0" />
                  <span className="min-w-0 space-y-1">
                    <span className="font-heading block font-semibold">{report.trackingCode}</span>
                    <span className="text-muted block text-sm">
                      {translate(`reportType.${report.type}`)} ·{' '}
                      {dateFormatter.format(new Date(report.createdAt))}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <StatusBadge status={report.status} />
                      {report.isDemo && <DemoBadge />}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="followup" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="followup" className="text-2xl font-semibold">
            {translate('followup.myFollowup')}
            {unreadFollowup > 0 && (
              <Badge tone="accent" className="ml-2 align-middle">
                {unreadFollowup} {translate('subscribe.unread')}
              </Badge>
            )}
          </h2>
          {unreadFollowup > 0 && <MarkNotificationsReadButton endpoint="/api/account/followup" />}
        </div>
        {prompts.map((prompt) => (
          <FeedbackPromptCard
            key={prompt.id}
            promptId={prompt.id}
            title={`${prompt.episode.name}${prompt.neighborhood ? ` (${prompt.neighborhood.name})` : ''} : ${translate('episodes.promptQuestion')}`}
          />
        ))}
        {pendingChecks.map((report) => (
          <div key={report.trackingCode} className="space-y-1">
            <p className="text-muted text-sm">
              {translate('followup.toAnswer')} :{' '}
              <Link
                href={`/signalements/${report.trackingCode}`}
                className="text-primary underline"
              >
                {report.trackingCode}
              </Link>{' '}
              · {translate(`reportType.${report.type}`)}
            </p>
            <ResolutionQuestion code={report.trackingCode} known />
          </div>
        ))}
        {followup.length === 0 && pendingChecks.length === 0 && prompts.length === 0 ? (
          <EmptyState title={translate('followup.myFollowupEmpty')} />
        ) : (
          <ul className="grid gap-2" data-testid="followup-list">
            {followup.map((item) => (
              <li
                key={item.id}
                className="rounded-control border-line bg-surface-raised flex flex-wrap items-center justify-between gap-2 border p-3"
              >
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block font-medium">{item.title}</span>
                  {item.body && <span className="text-muted block text-sm">{item.body}</span>}
                  <span className="text-muted block text-xs">
                    {dateFormatter.format(new Date(item.createdAt))}
                    {!item.read && (
                      <Badge tone="accent" className="ml-2">
                        {translate('subscribe.unread')}
                      </Badge>
                    )}
                  </span>
                </span>
                {item.link && (
                  <Link href={item.link as '/'} className={buttonVariants({ variant: 'ghost' })}>
                    {translate('followup.open')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notifications" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="notifications" className="text-2xl font-semibold">
            {translate('subscribe.myNotifications')}
            {unread > 0 && (
              <Badge tone="accent" className="ml-2 align-middle">
                {unread} {translate('subscribe.unread')}
              </Badge>
            )}
          </h2>
          {unread > 0 && <MarkNotificationsReadButton />}
        </div>
        {simulated && <StateBanner kind="info" title={translate('notifications.simulationMode')} />}
        {notifications.length === 0 ? (
          <EmptyState title={translate('subscribe.myNotificationsEmpty')} />
        ) : (
          <ul className="grid gap-4">
            {notifications.map((notification) => (
              <li key={notification.id} className="space-y-1" data-testid="notification">
                <p className="text-muted text-sm">
                  {notification.channels
                    .map((c) =>
                      c.channel === 'IN_APP'
                        ? translate('subscribe.deliveredInApp')
                        : `${translate('subscribe.deliveredWebPush')} : ${translate(`subscribe.status${c.status}`)}`,
                    )
                    .join(' · ')}{' '}
                  · {dateFormatter.format(new Date(notification.createdAt))}
                  {!notification.read && (
                    <Badge tone="accent" className="ml-2">
                      {translate('subscribe.unread')}
                    </Badge>
                  )}
                </p>
                <AlertCard alert={notification.alert} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="abonnements" aria-labelledby="subscriptions" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="subscriptions" className="text-2xl font-semibold">
            {translate('subscribe.mySubscriptions')}
          </h2>
          <Link href="/s-abonner" className={buttonVariants({ variant: 'outline' })}>
            <BellRing aria-hidden="true" />
            {translate('subscribe.add')}
          </Link>
        </div>
        {subscriptions.length === 0 ? (
          <EmptyState title={translate('subscribe.mySubscriptionsEmpty')} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {subscriptions.map((subscription) => (
              <li key={subscription.id}>
                <Card className="space-y-2" data-testid="subscription">
                  <p className="font-heading font-semibold">
                    {subscription.point
                      ? `${translate('subscribe.around')} (${subscription.point.radiusMeters < 1000 ? `${subscription.point.radiusMeters} m` : `${subscription.point.radiusMeters / 1000} km`})`
                      : subscription.neighborhoods.map((n) => n.name).join(', ')}
                  </p>
                  <p className="text-muted text-sm">
                    {translate('subscribe.minLevel')} : {levelLabel(subscription.minLevel)} ·{' '}
                    {[
                      subscription.channelInApp && translate('subscribe.channelInApp'),
                      subscription.channelWebPush &&
                        `${translate('subscribe.channelWebPush')}${simulated ? ` (${translate('subscribe.statusSIMULATED')})` : ''}`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <DeleteSubscriptionButton id={subscription.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle>{translate('account.profile')}</CardTitle>
          <ProfileForm
            name={user.name}
            locale={user.locale}
            notifyStatusChanges={preferences.notifyStatusChanges}
          />
        </Card>
        <Card className="space-y-4">
          <CardTitle>{translate('account.privacy')}</CardTitle>
          <PrivacyActions canDelete={user.role === 'CITIZEN'} />
        </Card>
      </div>
    </PageShell>
  );
}
