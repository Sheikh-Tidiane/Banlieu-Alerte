'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';

type Mode = 'login' | 'register';
type Errors = Partial<Record<'name' | 'email' | 'password', string>>;

/** Chemin de retour après connexion : uniquement un chemin interne (pas de redirection ouverte). */
export function safeNextPath(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/mon-espace';
}

/** Formulaire de connexion ou d'inscription (citoyen). */
export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setErrors({});
    setMessage(null);
    try {
      const body = mode === 'login' ? { email: values.email, password: values.password } : values;
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const result = (await response.json().catch(() => null)) as {
          data?: { secondFactorRequired?: boolean };
        } | null;
        // Administrateur : second facteur avant tout accès (EXG-41).
        const target = result?.data?.secondFactorRequired
          ? `/connexion/second-facteur?suite=${encodeURIComponent(safeNextPath(next ?? '/back-office'))}`
          : safeNextPath(next);
        router.replace(target as '/mon-espace');
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: { message: string; details?: Record<string, string[]> };
      } | null;
      const details = payload?.error?.details ?? {};
      setErrors({
        name: details.name?.[0],
        email: details.email?.[0],
        password: details.password?.[0],
      });
      setMessage(payload?.error?.message ?? translate('auth.error'));
    } catch {
      setMessage(translate('auth.error'));
    } finally {
      setSending(false);
    }
  }

  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {message && <StateBanner kind="error" title={message} />}
      {mode === 'register' && (
        <Field label={translate('auth.name')} error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="name"
              required
              {...field('name')}
            />
          )}
        </Field>
      )}
      <Field label={translate('auth.email')} error={errors.email}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            inputMode="email"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="email"
            required
            {...field('email')}
          />
        )}
      </Field>
      <Field
        label={translate('auth.password')}
        hint={mode === 'register' ? translate('auth.passwordHint') : undefined}
        error={errors.password}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            {...field('password')}
          />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth disabled={sending}>
        {sending
          ? translate('auth.sending')
          : translate(mode === 'login' ? 'auth.submitLogin' : 'auth.submitRegister')}
      </Button>
      <p className="text-center text-sm">
        {mode === 'login' ? translate('auth.noAccount') : translate('auth.hasAccount')}{' '}
        <Link
          href={mode === 'login' ? '/inscription' : '/connexion'}
          className="text-primary font-semibold underline underline-offset-2"
        >
          {translate(mode === 'login' ? 'auth.register' : 'auth.login')}
        </Link>
      </p>
    </form>
  );
}
