import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DemoActions } from '@/components/backoffice/demo-actions';
import { Card, CardTitle } from '@/components/ui/card';
import { translate } from '@/i18n';
import { requirePageUser } from '@/permissions/require';
import { isDemoMode } from '@/services/demo/simulator';

export const metadata: Metadata = { title: translate('demo.title') };

const STEPS = [
  { key: 'demo.step1', href: null },
  { key: 'demo.step2', href: '/carte-risque' },
  { key: 'demo.step3', href: '/back-office/alertes?statut=PENDING_APPROVAL' },
  { key: 'demo.step4', href: '/carte' },
  { key: 'demo.step5', href: '/qualite-indice' },
  { key: 'demo.step6', href: null },
] as const;

export default async function DemoPage() {
  // Hors mode démonstration, la page n'existe pas (D-063).
  if (!isDemoMode()) notFound();
  await requirePageUser('/back-office/demo', ['ADMIN']);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('demo.title')}</h2>
        <p className="text-muted max-w-3xl">{translate('demo.intro')}</p>
      </div>
      <DemoActions />
      <Card className="space-y-3">
        <CardTitle>{translate('demo.scenario')}</CardTitle>
        <ol className="list-decimal space-y-2 pl-5">
          {STEPS.map((step) => (
            <li key={step.key}>
              {translate(step.key)}{' '}
              {step.href && (
                <Link href={step.href as '/'} className="text-primary underline">
                  {translate('demo.open')}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
