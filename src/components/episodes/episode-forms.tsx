'use client';

import { CheckCheck, Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAction } from '@/components/backoffice/use-action';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';
import { fromDakarInput } from '@/lib/utils/dakar-time';

type Label = 'FLOODED' | 'NOT_FLOODED' | 'UNKNOWN';

/** Déclaration d'un épisode (agent, administrateur). */
export function CreateEpisodeForm({
  defaults,
}: {
  defaults: { startsAt: string; endsAt: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [endsAt, setEndsAt] = useState(defaults.endsAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        startsAt: fromDakarInput(startsAt),
        endsAt: fromDakarInput(endsAt),
      }),
    }).catch(() => null);
    setPending(false);
    const payload = (await response?.json().catch(() => null)) as {
      data?: { id: string };
      error?: { message: string; details?: Record<string, string[]> };
    } | null;
    if (response?.ok && payload?.data) {
      toast(translate('episodes.created'));
      router.push(`/back-office/episodes/${payload.data.id}`);
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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={translate('episodes.name')}>
        {({ id }) => (
          <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={translate('episodes.startsAt')}>
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
        </Field>
        <Field label={translate('episodes.endsAt')}>
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          )}
        </Field>
      </div>
      {error && <StateBanner kind="error" title={error} />}
      <Button type="submit" disabled={pending || name.trim().length < 3}>
        <Plus aria-hidden="true" />
        {translate('episodes.create')}
      </Button>
    </form>
  );
}

type Cell = {
  id: string;
  label: string;
  neighborhood: { id: string; name: string } | null;
  current: Label;
  floodReports: number;
};

/** Étiquetage par case, regroupé par quartier ; seules les modifications sont envoyées. */
export function LabelingForm({
  episodeId,
  cells,
  readOnly,
}: {
  episodeId: string;
  cells: Cell[];
  readOnly: boolean;
}) {
  const { pending, error, run } = useAction();
  const [values, setValues] = useState<Record<string, Label>>(() =>
    Object.fromEntries(cells.map((c) => [c.id, c.current])),
  );
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; cells: Cell[] }>();
    for (const cell of cells) {
      const key = cell.neighborhood?.id ?? '';
      const group = map.get(key) ?? {
        name: cell.neighborhood?.name ?? translate('episodes.unidentified'),
        cells: [],
      };
      group.cells.push(cell);
      map.set(key, group);
    }
    return [...map.values()];
  }, [cells]);
  const changes = cells
    .filter((c) => values[c.id] !== c.current)
    .map((c) => ({ cellId: c.id, label: values[c.id]! }));

  if (cells.length === 0) return <p className="text-muted">{translate('episodes.noCells')}</p>;

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (changes.length > 0) {
          await run(
            `/api/episodes/${episodeId}/labels`,
            'POST',
            { labels: changes },
            translate('episodes.saved'),
          );
        }
      }}
    >
      {groups.map((group) => (
        <fieldset key={group.name} className="space-y-2">
          <legend className="font-heading text-lg font-semibold">{group.name}</legend>
          <ul className="grid gap-2 md:grid-cols-2">
            {group.cells.map((cell) => (
              <li
                key={cell.id}
                className="rounded-control border-line bg-surface-raised flex flex-wrap items-center justify-between gap-2 border p-2"
                data-testid="label-cell"
              >
                <span className="text-sm">
                  {translate('episodes.cell')} {cell.label}
                  {cell.floodReports > 0 && (
                    <span className="text-danger block text-xs font-medium">
                      {cell.floodReports} {translate('episodes.floodReports')}
                    </span>
                  )}
                </span>
                <select
                  aria-label={`${translate('episodes.cell')} ${cell.label}`}
                  value={values[cell.id]}
                  disabled={readOnly}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [cell.id]: e.target.value as Label }))
                  }
                  className="min-h-touch rounded-control border-line bg-surface-raised border-2 px-2 text-sm"
                >
                  {(['UNKNOWN', 'FLOODED', 'NOT_FLOODED'] as const).map((label) => (
                    <option key={label} value={label}>
                      {translate(`episodes.label.${label}`)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      {error && <StateBanner kind="error" title={error} />}
      {!readOnly && (
        <Button type="submit" disabled={pending || changes.length === 0}>
          <Save aria-hidden="true" />
          {translate('episodes.save')} ({changes.length})
        </Button>
      )}
    </form>
  );
}

export function ValidateEpisodeButton({ episodeId }: { episodeId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(`/api/episodes/${episodeId}/validate`, 'POST', {}, translate('episodes.validated'))
        }
      >
        <CheckCheck aria-hidden="true" />
        {translate('episodes.validate')}
      </Button>
      <p className="text-muted text-sm">{translate('episodes.validateHint')}</p>
      {error && <StateBanner kind="error" title={error} />}
    </div>
  );
}

/** « Votre rue a-t-elle été inondée ? » dans Mon espace. */
export function FeedbackPromptCard({ promptId, title }: { promptId: string; title: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(value: 'FLOODED' | 'NOT_FLOODED' | 'DONT_KNOW') {
    setError(null);
    const response = await fetch('/api/feedback/flooded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, answer: value }),
    }).catch(() => null);
    if (response?.ok) {
      setDone(true);
      router.refresh();
    } else setError(translate('design.errorBody'));
  }

  if (done) return <StateBanner kind="success" title={translate('episodes.promptThanks')} />;
  return (
    <div
      className="rounded-card border-water bg-water/10 space-y-3 border-2 p-4"
      data-testid="feedback-prompt"
    >
      <p className="font-heading font-semibold">{title}</p>
      <p className="text-sm">{translate('episodes.promptHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => answer('FLOODED')}>
          {translate('episodes.promptYes')}
        </Button>
        <Button type="button" variant="outline" onClick={() => answer('NOT_FLOODED')}>
          {translate('episodes.promptNo')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => answer('DONT_KNOW')}>
          {translate('episodes.promptDontKnow')}
        </Button>
      </div>
      {error && <StateBanner kind="error" title={error} />}
    </div>
  );
}
