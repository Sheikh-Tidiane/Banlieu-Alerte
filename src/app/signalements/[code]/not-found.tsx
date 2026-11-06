import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';

export default function ReportNotFound() {
  return (
    <PageShell className="max-w-2xl">
      <EmptyState
        title={translate('detail.notFoundTitle')}
        body={translate('detail.notFoundLead')}
        action={
          <Link href="/carte" className={buttonVariants({ variant: 'primary' })}>
            {translate('detail.backToMap')}
          </Link>
        }
      />
    </PageShell>
  );
}
