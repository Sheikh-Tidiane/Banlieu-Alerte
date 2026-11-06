import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('auth.forbiddenTitle') };

export default function ForbiddenPage() {
  return (
    <PageShell className="max-w-xl">
      <EmptyState
        title={translate('auth.forbiddenTitle')}
        body={translate('auth.forbiddenLead')}
        action={
          <Link href="/" className={buttonVariants({ variant: 'primary' })}>
            {translate('auth.backHome')}
          </Link>
        }
      />
    </PageShell>
  );
}
