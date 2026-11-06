'use client';

import { Download, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

export function ProfileForm({
  name,
  locale,
  notifyStatusChanges,
}: {
  name: string;
  locale: string;
  notifyStatusChanges: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [lang, setLang] = useState(locale);
  const [consent, setConsent] = useState(notifyStatusChanges);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const response = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: value, locale: lang, notifyStatusChanges: consent }),
    }).catch(() => null);
    setPending(false);
    if (response?.ok) {
      toast(translate('account.saved'));
      router.refresh();
      return;
    }
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string; details?: Record<string, string[]> };
    } | null;
    setError(
      payload?.error?.details?.name?.[0] ??
        payload?.error?.message ??
        translate('design.errorBody'),
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={translate('auth.name')} error={error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </Field>
      <label className="block space-y-1 text-sm font-semibold">
        <span className="block">{translate('account.locale')}</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base font-normal"
        >
          <option value="fr">{translate('account.localeFr')}</option>
          <option value="wo">{translate('account.localeWo')}</option>
        </select>
      </label>
      <label className="min-h-touch flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="size-5 shrink-0"
        />
        {translate('followup.consent')}
      </label>
      <Button type="submit" disabled={pending}>
        {translate('account.save')}
      </Button>
    </form>
  );
}

export function PrivacyActions({ canDelete }: { canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const word = translate('account.deleteConfirmWord');

  async function remove() {
    setPending(true);
    const response = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
    setPending(false);
    if (response?.ok) {
      setOpen(false);
      toast(translate('account.deleted'));
      router.replace('/');
      router.refresh();
    } else {
      toast(translate('design.errorBody'), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p>{translate('account.exportLead')}</p>
        <a href="/api/account" download className={buttonVariants({ variant: 'outline' })}>
          <Download aria-hidden="true" />
          {translate('account.export')}
        </a>
      </div>
      {canDelete && (
        <div className="space-y-2">
          <p>{translate('account.deleteLead')}</p>
          <Button variant="danger" onClick={() => setOpen(true)}>
            <Trash aria-hidden="true" />
            {translate('account.delete')}
          </Button>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={translate('account.deleteConfirmTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {translate('common.cancel')}
            </Button>
            <Button variant="danger" disabled={pending || confirmation !== word} onClick={remove}>
              {translate('account.delete')}
            </Button>
          </>
        }
      >
        <p className="mb-4">{translate('account.deleteConfirmLead')}</p>
        <Field label={word}>
          {({ id }) => (
            <Input
              id={id}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
