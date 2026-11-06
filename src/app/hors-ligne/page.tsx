import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('offline.pageTitle') };

/** Page servie par le service worker quand une page n'est pas en cache. */
export default function OfflinePage() {
  return (
    <PageShell className="max-w-xl space-y-5 text-center">
      <CloudOff aria-hidden="true" className="text-water mx-auto size-14" />
      <h1 className="text-3xl font-bold">{translate('offline.pageTitle')}</h1>
      <p>{translate('offline.pageLead')}</p>
      <Link href="/signaler" className={buttonVariants({ size: 'lg' })}>
        {translate('offline.goReport')}
      </Link>
    </PageShell>
  );
}
