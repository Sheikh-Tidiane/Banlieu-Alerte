import type { Metadata } from 'next';
import { InteractiveDemo } from '@/components/design/interactive-demo';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import {
  DemoBadge,
  RiskBadge,
  StatusBadge,
  type ReportStatus,
  type RiskLevel,
} from '@/components/ui/badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState, Skeleton, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('design.title') };

// Échantillons : nom du token CSS et classe Tailwind correspondante.
const swatches = [
  { token: '--brand-green', className: 'bg-primary' },
  { token: '--brand-green-light', className: 'bg-primary-light' },
  { token: '--brand-yellow', className: 'bg-accent' },
  { token: '--brand-water', className: 'bg-water' },
  { token: '--alert-red', className: 'bg-danger' },
  { token: '--vigilance-orange', className: 'bg-warning' },
  { token: '--safety-green', className: 'bg-safe' },
  { token: '--neutral-bg', className: 'bg-surface' },
  { token: '--neutral-ink', className: 'bg-ink' },
  { token: '--neutral-line', className: 'bg-line' },
] as const;

const riskLevels: RiskLevel[] = ['low', 'moderate', 'high', 'critical', 'limitedData'];
const statuses: ReportStatus[] = [
  'NEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
];
const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <PageShell className="space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">{translate('design.title')}</h1>
        <p className="text-muted text-lg">{translate('design.lead')}</p>
      </div>

      <Section id="colors" title={translate('design.colors')}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map(({ token, className }) => (
            <li
              key={token}
              className="rounded-card border-line bg-surface-raised overflow-hidden border"
            >
              <div className={`h-16 ${className}`} />
              <p className="p-2 font-mono text-xs break-all">{token}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="typography" title={translate('design.typography')}>
        <Card className="space-y-2">
          <p className="font-heading text-3xl font-bold">{translate('design.headingSample')}</p>
          <p>{translate('design.bodySample')}</p>
        </Card>
      </Section>

      <Section id="buttons" title={translate('design.buttons')}>
        <div className="flex flex-wrap gap-3">
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant}>
              {translate(`design.buttonVariants.${variant}`)}
            </Button>
          ))}
          <Button disabled>{translate('design.buttonVariants.primary')}</Button>
        </div>
      </Section>

      <Section id="badges" title={translate('design.badges')}>
        <div className="space-y-3">
          <h3 className="font-semibold">{translate('design.riskLevels')}</h3>
          <div className="flex flex-wrap gap-2">
            {riskLevels.map((level) => (
              <RiskBadge key={level} level={level} />
            ))}
          </div>
          <h3 className="pt-2 font-semibold">{translate('design.reportStatuses')}</h3>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
            <DemoBadge />
          </div>
        </div>
      </Section>

      <Section id="states" title={translate('design.states')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3" aria-busy="true" aria-label={translate('common.loading')}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full" />
          </Card>
          <EmptyState title={translate('design.emptyTitle')} body={translate('design.emptyBody')} />
          <StateBanner
            kind="error"
            title={translate('design.errorTitle')}
            body={translate('design.errorBody')}
          />
          <StateBanner
            kind="success"
            title={translate('design.successTitle')}
            body={translate('design.successBody')}
          />
          <StateBanner
            kind="offline"
            title={translate('design.offlineTitle')}
            body={translate('design.offlineBody')}
          />
          <StateBanner
            kind="syncPending"
            title={translate('design.syncTitle')}
            body={translate('design.syncBody')}
          />
        </div>
      </Section>

      <Section
        id="interactive"
        title={`${translate('design.form')} · ${translate('design.feedback')}`}
      >
        <Card>
          <CardTitle>{translate('design.form')}</CardTitle>
          <CardDescription>{translate('design.fieldHint')}</CardDescription>
          <div className="mt-4">
            <InteractiveDemo />
          </div>
        </Card>
      </Section>
    </PageShell>
  );
}
