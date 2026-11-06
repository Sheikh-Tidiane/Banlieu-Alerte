import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { translate } from '@/i18n';

export const metadata: Metadata = { title: translate('auth.loginTitle') };

type Props = { searchParams: Promise<{ suite?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { suite } = await searchParams;
  return (
    <PageShell className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('auth.loginTitle')}</h1>
        <p className="text-muted">{translate('auth.loginLead')}</p>
      </div>
      <Card>
        <AuthForm mode="login" next={suite} />
      </Card>
      <p className="text-muted text-sm">{translate('auth.staffNote')}</p>
    </PageShell>
  );
}
