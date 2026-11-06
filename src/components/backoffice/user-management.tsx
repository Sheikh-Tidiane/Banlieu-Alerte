'use client';

import { Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

type Option = { id: string; name: string };
type ApiError = { error?: { message: string; details?: Record<string, string[]> } };

const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base';

async function call(url: string, method: 'POST' | 'DELETE', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as
    (ApiError & { data?: unknown }) | null;
  return { ok: response.ok, payload };
}

/** Lien sensible affiché une seule fois, avec bouton de copie. */
function OneTimeLink({ title, link }: { title: string; link: string }) {
  const toast = useToast();
  return (
    <div className="rounded-card border-water/40 bg-water/10 space-y-2 border p-4" role="status">
      <p className="font-semibold">{title}</p>
      <p
        className="bg-surface-raised rounded-control px-3 py-2 font-mono text-sm break-all"
        data-testid="one-time-link"
      >
        {link}
      </p>
      <p className="text-muted text-xs">{translate('backoffice.users.simulation')}</p>
      <Button
        variant="outline"
        onClick={async () => {
          await navigator.clipboard?.writeText(link).catch(() => undefined);
          toast(translate('backoffice.users.copied'));
        }}
      >
        <Copy aria-hidden="true" />
        {translate('backoffice.users.copy')}
      </Button>
    </div>
  );
}

export function InviteForm({
  communes,
  neighborhoods,
}: {
  communes: Option[];
  neighborhoods: Option[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'DELEGATE' | 'AGENT' | 'ADMIN'>('DELEGATE');
  const [communeId, setCommuneId] = useState(communes[0]?.id ?? '');
  const [neighborhoodId, setNeighborhoodId] = useState(neighborhoods[0]?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setLink(null);
    const { ok, payload } = await call('/api/invitations', 'POST', {
      email,
      role,
      ...(role === 'AGENT' ? { communeId } : {}),
      ...(role === 'DELEGATE' ? { neighborhoodId } : {}),
    });
    setPending(false);
    if (!ok) {
      const details = payload?.error?.details ?? {};
      setErrors({
        email: details.email?.[0],
        communeId: details.communeId?.[0],
        neighborhoodId: details.neighborhoodId?.[0],
        form: payload?.error?.message,
      });
      return;
    }
    setLink((payload?.data as { link: string }).link);
    setEmail('');
    router.refresh();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {errors.form && !errors.email && <StateBanner kind="error" title={errors.form} />}
      <Field label={translate('backoffice.users.email')} error={errors.email}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <label className="block space-y-1 text-sm font-semibold">
        <span className="block">{translate('backoffice.users.role')}</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className={selectClass}
        >
          {(['DELEGATE', 'AGENT', 'ADMIN'] as const).map((r) => (
            <option key={r} value={r}>
              {translate(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>
      {role === 'AGENT' && (
        <label className="block space-y-1 text-sm font-semibold">
          <span className="block">{translate('backoffice.users.commune')}</span>
          <select
            value={communeId}
            onChange={(e) => setCommuneId(e.target.value)}
            className={selectClass}
          >
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.communeId && <span className="text-danger block">{errors.communeId}</span>}
        </label>
      )}
      {role === 'DELEGATE' && (
        <label className="block space-y-1 text-sm font-semibold">
          <span className="block">{translate('backoffice.users.neighborhood')}</span>
          <select
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
            className={selectClass}
          >
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          {errors.neighborhoodId && (
            <span className="text-danger block">{errors.neighborhoodId}</span>
          )}
        </label>
      )}
      <Button type="submit" disabled={pending || !email}>
        {translate('backoffice.users.invite')}
      </Button>
      {link && <OneTimeLink title={translate('backoffice.users.inviteCreated')} link={link} />}
    </form>
  );
}

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { ok } = await call(`/api/invitations/${invitationId}`, 'DELETE');
        setPending(false);
        toast(
          translate(ok ? 'backoffice.users.revoked' : 'design.errorBody'),
          ok ? 'success' : 'error',
        );
        if (ok) router.refresh();
      }}
    >
      {translate('backoffice.users.revoke')}
    </Button>
  );
}

type Account = {
  id: string;
  name: string;
  email: string | null;
  role: 'CITIZEN' | 'DELEGATE' | 'AGENT' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  isDemo: boolean;
  scope: string | null;
};

export function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function toggleBlock() {
    setPending(true);
    const { ok, payload } = await call(`/api/admin/users/${account.id}/block`, 'POST', {
      blocked: account.status === 'ACTIVE',
    });
    setPending(false);
    toast(
      ok
        ? translate('backoffice.moderation.done')
        : (payload?.error?.message ?? translate('design.errorBody')),
      ok ? 'success' : 'error',
    );
    if (ok) router.refresh();
  }

  async function reset() {
    setPending(true);
    const { ok, payload } = await call('/api/password-resets', 'POST', { userId: account.id });
    setPending(false);
    if (ok) setResetLink((payload?.data as { link: string }).link);
    else toast(payload?.error?.message ?? translate('design.errorBody'), 'error');
  }

  return (
    <li className="rounded-card border-line bg-surface-raised space-y-3 border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{account.name}</span>
        {isSelf && (
          <span className="text-muted text-sm">({translate('backoffice.users.you')})</span>
        )}
        <Badge tone="primary">{translate(`roles.${account.role}`)}</Badge>
        <Badge tone={account.status === 'ACTIVE' ? 'safe' : 'danger'}>
          {translate(
            account.status === 'ACTIVE'
              ? 'backoffice.users.statusActive'
              : 'backoffice.users.statusBlocked',
          )}
        </Badge>
        {account.isDemo && <DemoBadge />}
      </div>
      <p className="text-muted text-sm break-all">
        {account.email}
        {account.scope ? ` · ${account.scope}` : ''}
      </p>
      {!isSelf && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={toggleBlock}>
            {translate(
              account.status === 'ACTIVE' ? 'backoffice.users.block' : 'backoffice.users.unblock',
            )}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={reset}>
            {translate('backoffice.users.resetPassword')}
          </Button>
        </div>
      )}
      {resetLink && (
        <OneTimeLink title={translate('backoffice.users.resetCreated')} link={resetLink} />
      )}
    </li>
  );
}
