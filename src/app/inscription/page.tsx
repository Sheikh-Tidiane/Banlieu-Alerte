import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('auth.registerTitle') };

export default function RegisterPage() {
  return (
    <PageShell className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('auth.registerTitle')}</h1>
        <p className="text-muted">{translate('auth.registerLead')}</p>
      </div>
      <Card>
        <AuthForm mode="register" />
      </Card>
      <p className="text-muted text-sm">{translate('auth.emailNotVerified')}</p>
      <p className="text-muted text-sm">{translate('auth.staffNote')}</p>
    </PageShell>
  );
}
