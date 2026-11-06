'use client';

import { Ban, Check, Save, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';
import { levelLabel } from '@/lib/risk/explain';
import { RISK_LEVELS, type RiskLevelCode } from '@/lib/risk/types';
import { fromDakarInput } from '@/lib/utils/dakar-time';
import { useAction } from './use-action';

type AlertType = 'OFFICIAL' | 'INDICATIVE';
type Neighborhood = { id: string; name: string };

export type AlertDraft = {
  type: AlertType;
  level: RiskLevelCode;
  issuerName: string;
  title: string;
  messageFr: string;
  messageWo: string;
  woReviewed: boolean;
  advice: string;
  neighborhoodIds: string[];
  /** Valeurs des champs datetime-local, à l'heure de Dakar (UTC, sans heure d'été). */
  validUntil: string;
  scheduledAt: string;
};

const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base';

function toPayload(draft: AlertDraft, withType: boolean) {
  return {
    ...(withType ? { type: draft.type } : {}),
    level: draft.level,
    issuerName: draft.issuerName,
    title: draft.title,
    messageFr: draft.messageFr,
    ...(draft.messageWo.trim() ? { messageWo: draft.messageWo } : {}),
    woReviewed: draft.woReviewed && Boolean(draft.messageWo.trim()),
    ...(draft.advice.trim() ? { advice: draft.advice } : {}),
    neighborhoodIds: draft.neighborhoodIds,
    validUntil: draft.validUntil ? fromDakarInput(draft.validUntil) : undefined,
    ...(draft.scheduledAt ? { scheduledAt: fromDakarInput(draft.scheduledAt) } : {}),
  };
}

function AlertFields({
  draft,
  onChange,
  neighborhoods,
  allowedTypes,
  typeEditable,
}: {
  draft: AlertDraft;
  onChange: (draft: AlertDraft) => void;
  neighborhoods: Neighborhood[];
  allowedTypes: AlertType[];
  typeEditable: boolean;
}) {
  const set = <K extends keyof AlertDraft>(key: K, value: AlertDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const official = draft.type === 'OFFICIAL';

  return (
    <div className="space-y-4">
      {typeEditable && (
        <label className="block space-y-1 font-semibold">
          <span className="block">{translate('backoffice.alerts.type')}</span>
          <select
            value={draft.type}
            onChange={(e) => set('type', e.target.value as AlertType)}
            className={selectClass}
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {translate(
                  type === 'OFFICIAL'
                    ? 'backoffice.alerts.typeOfficial'
                    : 'backoffice.alerts.typeIndicative',
                )}
              </option>
            ))}
          </select>
          {!allowedTypes.includes('OFFICIAL') && (
            <span className="text-muted block text-sm font-normal">
              {translate('backoffice.alerts.officialReserved')}
            </span>
          )}
        </label>
      )}
      <label className="block space-y-1 font-semibold">
        <span className="block">{translate('backoffice.alerts.level')}</span>
        <select
          value={draft.level}
          onChange={(e) => set('level', e.target.value as RiskLevelCode)}
          className={selectClass}
        >
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {levelLabel(level)}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={translate('backoffice.alerts.issuer')}
        hint={translate(
          official
            ? 'backoffice.alerts.issuerHintOfficial'
            : 'backoffice.alerts.issuerHintIndicative',
        )}
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={draft.issuerName}
            onChange={(e) => set('issuerName', e.target.value)}
            maxLength={160}
          />
        )}
      </Field>
      <Field label={translate('backoffice.alerts.titleField')}>
        {({ id }) => (
          <Input
            id={id}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={160}
          />
        )}
      </Field>
      <Field label={translate('backoffice.alerts.messageFr')}>
        {({ id }) => (
          <Textarea
            id={id}
            value={draft.messageFr}
            onChange={(e) => set('messageFr', e.target.value)}
            maxLength={1000}
          />
        )}
      </Field>
      <Field label={translate('backoffice.alerts.messageWo')}>
        {({ id }) => (
          <Textarea
            id={id}
            lang="wo"
            value={draft.messageWo}
            onChange={(e) => set('messageWo', e.target.value)}
            maxLength={1000}
          />
        )}
      </Field>
      <label className="min-h-touch flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.woReviewed}
          disabled={!draft.messageWo.trim()}
          onChange={(e) => set('woReviewed', e.target.checked)}
          className="size-5"
        />
        {translate('backoffice.alerts.woReviewed')}
      </label>
      <Field label={translate('backoffice.alerts.advice')}>
        {({ id }) => (
          <Textarea
            id={id}
            value={draft.advice}
            onChange={(e) => set('advice', e.target.value)}
            maxLength={1000}
          />
        )}
      </Field>
      <fieldset className="space-y-1">
        <legend className="font-semibold">{translate('backoffice.alerts.neighborhoods')}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {neighborhoods.map((n) => (
            <label key={n.id} className="min-h-touch flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.neighborhoodIds.includes(n.id)}
                onChange={(e) =>
                  set(
                    'neighborhoodIds',
                    e.target.checked
                      ? [...draft.neighborhoodIds, n.id]
                      : draft.neighborhoodIds.filter((id) => id !== n.id),
                  )
                }
                className="size-5"
              />
              {n.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={translate('backoffice.alerts.validUntil')}>
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={draft.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
            />
          )}
        </Field>
        <Field
          label={translate('backoffice.alerts.scheduledAt')}
          hint={translate('backoffice.alerts.scheduledHint')}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="datetime-local"
              value={draft.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/** Création d'une alerte : elle part en attente d'approbation, jamais envoyée directement. */
export function CreateAlertForm({
  initial,
  neighborhoods,
  allowedTypes,
}: {
  initial: AlertDraft;
  neighborhoods: Neighborhood[];
  allowedTypes: AlertType[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(draft, true)),
    }).catch(() => null);
    setPending(false);
    const payload = (await response?.json().catch(() => null)) as {
      data?: { id: string };
      error?: { message: string; details?: Record<string, string[]> };
    } | null;
    if (response?.ok && payload?.data) {
      toast(translate('backoffice.alerts.created'));
      router.push(`/back-office/alertes/${payload.data.id}`);
      return;
    }
    const details = payload?.error?.details;
    setError(
      (details && Object.values(details)[0]?.[0]) ??
        payload?.error?.message ??
        translate('design.errorBody'),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <AlertFields
        draft={draft}
        onChange={setDraft}
        neighborhoods={neighborhoods}
        allowedTypes={allowedTypes}
        typeEditable
      />
      {error && <StateBanner kind="error" title={error} />}
      <Button type="submit" disabled={pending}>
        <Save aria-hidden="true" />
        {translate('backoffice.alerts.create')}
      </Button>
    </form>
  );
}

/** Approbation (avec corrections éventuelles), ou simple enregistrement du brouillon. */
export function ApproveAlertForm({
  id,
  initial,
  neighborhoods,
}: {
  id: string;
  initial: AlertDraft;
  neighborhoods: Neighborhood[];
}) {
  const { pending, error, run } = useAction();
  const [draft, setDraft] = useState(initial);
  const [reason, setReason] = useState('');

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          `/api/alerts/${id}/approve`,
          'POST',
          { changes: toPayload(draft, false), ...(reason.trim() ? { reason } : {}) },
          translate('backoffice.alerts.approved'),
        );
      }}
    >
      <p className="text-muted text-sm">{translate('backoffice.alerts.approveHint')}</p>
      <AlertFields
        draft={draft}
        onChange={setDraft}
        neighborhoods={neighborhoods}
        allowedTypes={[draft.type]}
        typeEditable={false}
      />
      <Field label={translate('backoffice.alerts.approveReason')}>
        {({ id: fieldId }) => (
          <Input
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        )}
      </Field>
      {error && <StateBanner kind="error" title={error} />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          <Send aria-hidden="true" />
          {translate('backoffice.alerts.approve')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              `/api/alerts/${id}`,
              'PATCH',
              toPayload(draft, false),
              translate('backoffice.alerts.saved'),
            )
          }
        >
          <Check aria-hidden="true" />
          {translate('backoffice.alerts.saveDraft')}
        </Button>
      </div>
    </form>
  );
}

/** Rejet d'un brouillon ou annulation d'une alerte, avec motif obligatoire. */
export function ReasonActionForm({ id, action }: { id: string; action: 'reject' | 'cancel' }) {
  const { pending, error, run } = useAction();
  const [reason, setReason] = useState('');
  const reject = action === 'reject';
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const done = await run(
          `/api/alerts/${id}/${action}`,
          'POST',
          { reason },
          translate(reject ? 'backoffice.alerts.rejected' : 'backoffice.alerts.cancelled'),
        );
        if (done) setReason('');
      }}
    >
      <Field
        label={translate(
          reject ? 'backoffice.alerts.rejectReason' : 'backoffice.alerts.cancelReason',
        )}
        error={error ?? undefined}
      >
        {({ id: fieldId, describedBy, invalid }) => (
          <Textarea
            id={fieldId}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            maxLength={500}
          />
        )}
      </Field>
      <Button type="submit" variant="danger" disabled={pending || reason.trim().length < 5}>
        {reject ? <X aria-hidden="true" /> : <Ban aria-hidden="true" />}
        {translate(reject ? 'backoffice.alerts.reject' : 'backoffice.alerts.cancel')}
      </Button>
    </form>
  );
}
