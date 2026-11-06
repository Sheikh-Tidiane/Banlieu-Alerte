import type { Metadata } from 'next';
import { EmergencyNumbers } from '@/components/emergency/emergency-numbers';
import { PageShell } from '@/components/layout/page-shell';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('emergency.title') };

export default function EmergencyPage() {
  return (
    <PageShell className="max-w-2xl space-y-6">
      <h1 className="text-danger text-3xl font-bold">{translate('emergency.pageTitle')}</h1>
      <EmergencyNumbers />
    </PageShell>
  );
}
