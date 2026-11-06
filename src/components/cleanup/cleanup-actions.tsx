'use client';

import { CalendarPlus, Camera, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAction } from '@/components/backoffice/use-action';
import { Button } from '@/components/ui/button';
import { StateBanner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';
import { fromDakarInput } from '@/lib/utils/dakar-time';

const inputClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-sm';

/** Planifier une opération pour un signalement. */
export function PlanCleanupForm({ trackingCode }: { trackingCode: string }) {
  const { pending, error, run } = useAction();
  const [team, setTeam] = useState('');
  const [plannedFor, setPlannedFor] = useState('');
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          '/api/cleanup',
          'POST',
          {
            trackingCode,
            team,
            ...(plannedFor ? { plannedFor: fromDakarInput(plannedFor) } : {}),
          },
          translate('cleanup.planned'),
        );
      }}
    >
      <label className="space-y-1 text-xs font-semibold">
        <span className="block">{translate('cleanup.team')}</span>
        <input
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className={inputClass}
          maxLength={160}
        />
      </label>
      <label className="space-y-1 text-xs font-semibold">
        <span className="block">{translate('cleanup.plannedFor')}</span>
        <input
          type="datetime-local"
          value={plannedFor}
          onChange={(e) => setPlannedFor(e.target.value)}
          className={inputClass}
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending || team.trim().length < 2}>
        <CalendarPlus aria-hidden="true" />
        {translate('cleanup.plan')}
      </Button>
      {error && <p className="text-danger text-sm sm:col-span-3">{error}</p>}
    </form>
  );
}

type Status = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export function UpdateCleanupForm({ id, status }: { id: string; status: Status }) {
  const { pending, error, run } = useAction();
  const [next, setNext] = useState<Status>(status === 'PLANNED' ? 'IN_PROGRESS' : 'DONE');
  const [resolve, setResolve] = useState(true);
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          `/api/cleanup/${id}`,
          'PATCH',
          { status: next, ...(next === 'DONE' ? { resolveReport: resolve } : {}) },
          translate('cleanup.updated'),
        );
      }}
    >
      <label className="block space-y-1 text-xs font-semibold">
        <span className="block">{translate('cleanup.newStatus')}</span>
        <select
          value={next}
          onChange={(e) => setNext(e.target.value as Status)}
          className={inputClass}
        >
          {(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const)
            .filter((s) => s !== status)
            .map((s) => (
              <option key={s} value={s}>
                {translate(`cleanup.status.${s}`)}
              </option>
            ))}
        </select>
      </label>
      {next === 'DONE' && (
        <label className="min-h-touch flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={resolve}
            onChange={(e) => setResolve(e.target.checked)}
            className="size-5"
          />
          {translate('cleanup.resolveReport')}
        </label>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        <Save aria-hidden="true" />
        {translate('cleanup.update')}
      </Button>
      {error && <StateBanner kind="error" title={error} />}
    </form>
  );
}

/** Photo avant ou après (EXIF retiré côté serveur). */
export function CleanupPhotoForm({ id, phase }: { id: string; phase: 'BEFORE' | 'AFTER' }) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const label = translate(phase === 'BEFORE' ? 'cleanup.photoBefore' : 'cleanup.photoAfter');

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set('phase', phase);
    body.set('photo', file);
    const response = await fetch(`/api/cleanup/${id}/photos`, { method: 'POST', body }).catch(
      () => null,
    );
    setPending(false);
    if (response?.ok) {
      toast(translate('cleanup.photoAdded'));
      setFile(null);
      router.refresh();
      return;
    }
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    setError(payload?.error?.message ?? translate('design.errorBody'));
  }

  return (
    <form onSubmit={upload} className="space-y-1">
      <label className="block space-y-1 text-xs font-semibold">
        <span className="block">{label}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </label>
      <Button type="submit" variant="ghost" disabled={pending || !file}>
        <Camera aria-hidden="true" />
        {translate('cleanup.addPhoto')}
      </Button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </form>
  );
}
