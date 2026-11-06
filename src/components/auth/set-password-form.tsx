'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';

/** Activation d'une invitation (nom + mot de passe) ou réinitialisation (mot de passe). */
export function SetPasswordForm({ mode, token }: { mode: 'invitation' | 'reset'; token: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setErrors({});
    setMessage(null);
    const url =
      mode === 'invitation'
        ? `/api/invitations/${token}/accept`
        : `/api/password-resets/${token}/accept`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'invitation' ? { name, password } : { password }),
      });
      if (response.ok) {
        // Invitation : compte sensible, direction le back-office ; réinitialisation : espace personnel.
        router.replace(mode === 'invitation' ? '/back-office' : ('/mon-espace' as '/back-office'));
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: { message: string; details?: Record<string, string[]> };
      } | null;
      setErrors({
        name: payload?.error?.details?.name?.[0],
        password: payload?.error?.details?.password?.[0],
      });
      setMessage(payload?.error?.message ?? translate('auth.error'));
    } catch {
      setMessage(translate('auth.error'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {message && <StateBanner kind="error" title={message} />}
      {mode === 'invitation' && (
        <Field label={translate('auth.name')} error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
      )}
      <Field
        label={translate('auth.password')}
        hint={translate('auth.passwordHint')}
        error={errors.password}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth disabled={sending}>
        {sending
          ? translate('auth.sending')
          : translate(mode === 'invitation' ? 'invitation.submit' : 'invitation.resetSubmit')}
      </Button>
    </form>
  );
}
