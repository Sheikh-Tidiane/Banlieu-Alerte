import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { ReportForm } from '@/components/report-form/report-form';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('reportForm.title') };

export default function ReportPage() {
  return (
    <PageShell className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{translate('reportForm.title')}</h1>
      <ReportForm />
    </PageShell>
  );
}
