'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { safeNextPath } from './auth-form';

async function post(path: string, code: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as {
    data?: { recoveryCodes?: string[]; remaining?: number };
    error?: { message: string };
  } | null;
  return { ok: Boolean(response?.ok), data: body?.data, error: body?.error?.message };
}

/** Saisie du code (enrôlement ou vérification), avec repli sur un code de secours. */
export function SecondFactorForm({ mode, next }: { mode: 'enroll' | 'verify'; next?: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const target = safeNextPath(next ?? '/back-office');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const path =
      mode === 'enroll'
        ? '/api/auth/mfa/confirm'
        : recovery
          ? '/api/auth/mfa/recovery'
          : '/api/auth/mfa/verify';
    const result = await post(path, code);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? translate('design.errorBody'));
      return;
    }
    if (result.data?.recoveryCodes) {
      setCodes(result.data.recoveryCodes);
      return;
    }
    if (typeof result.data?.remaining === 'number') setRemaining(result.data.remaining);
    router.replace(target as '/back-office');
    router.refresh();
  }

  if (codes) {
    return (
      <div className="space-y-4" data-testid="recovery-codes">
        <p className="font-heading text-lg font-semibold">{translate('mfa.recoveryTitle')}</p>
        <p className="text-sm">{translate('mfa.recoveryLead')}</p>
        <ul className="bg-surface rounded-control grid grid-cols-2 gap-2 p-3 font-mono text-base">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          type="button"
          onClick={() => {
            router.replace(target as '/back-office');
            router.refresh();
          }}
        >
          {translate('mfa.continue')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {remaining !== null && (
        <StateBanner
          kind="info"
          title={interpolate(translate('mfa.recoveryRemaining'), { count: remaining })}
        />
      )}
      <Field label={translate(recovery ? 'mfa.recoveryCode' : 'mfa.code')}>
        {({ id }) => (
          <Input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={recovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            maxLength={recovery ? 20 : 6}
            autoFocus
          />
        )}
      </Field>
      {error && <StateBanner kind="error" title={error} />}
      <Button type="submit" disabled={pending || code.trim().length < 6}>
        <ShieldCheck aria-hidden="true" />
        {translate(mode === 'enroll' ? 'mfa.confirm' : 'mfa.verify')}
      </Button>
      {mode === 'verify' && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
        >
          <KeyRound aria-hidden="true" />
          {translate(recovery ? 'mfa.useApp' : 'mfa.useRecovery')}
        </Button>
      )}
    </form>
  );
}
