'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { translate } from '@/i18n';
import type { ReportStatus } from '@/validators/report';
import { useAction } from './use-action';

const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base';

export function StatusForm({ code, transitions }: { code: string; transitions: ReportStatus[] }) {
  const { pending, error, run } = useAction();
  const [status, setStatus] = useState<ReportStatus | ''>(transitions[0] ?? '');
  const [reason, setReason] = useState('');
  if (transitions.length === 0) {
    return <p className="text-muted text-sm">{translate('backoffice.report.statusNone')}</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!status) return;
        const done = await run(
          `/api/reports/${code}/status`,
          'PATCH',
          { status, ...(reason ? { reason } : {}) },
          translate('backoffice.report.statusChanged'),
        );
        if (done) setReason('');
      }}
    >
      <label className="block space-y-1 text-sm font-semibold">
        <span className="block">{translate('backoffice.report.statusTo')}</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatus)}
          className={selectClass}
        >
          {transitions.map((to) => (
            <option key={to} value={to}>
              {translate(`reportStatus.${to}`)}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={translate('backoffice.report.reason')}
        hint={
          status === 'REJECTED'
            ? translate('backoffice.report.reasonRequired')
            : translate('backoffice.report.reasonHint')
        }
        error={error ?? undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {translate('backoffice.report.apply')}
      </Button>
    </form>
  );
}

export function AssignForm({
  code,
  assignable,
  currentAssigneeId,
  selfId,
}: {
  code: string;
  assignable: { id: string; name: string }[];
  currentAssigneeId: string | null;
  selfId: string;
}) {
  const { pending, error, run } = useAction();
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? assignable[0]?.id ?? '');
  if (assignable.length === 0)
    return <p className="text-muted text-sm">{translate('backoffice.report.noAgents')}</p>;
  const assign = (id: string | null) =>
    run(
      `/api/reports/${code}/assign`,
      'POST',
      { assigneeId: id },
      translate('backoffice.report.assigned'),
    );
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm font-semibold">
        <span className="block">{translate('backoffice.report.assignTo')}</span>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={selectClass}
        >
          {assignable.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
              {agent.id === selfId ? ` (${translate('backoffice.users.you')})` : ''}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !assigneeId} onClick={() => assign(assigneeId)}>
          {translate('backoffice.report.assign')}
        </Button>
        {assignable.some((agent) => agent.id === selfId) && (
          <Button variant="outline" disabled={pending} onClick={() => assign(selfId)}>
            {translate('backoffice.report.assignSelf')}
          </Button>
        )}
        {currentAssigneeId && (
          <Button variant="ghost" disabled={pending} onClick={() => assign(null)}>
            {translate('backoffice.report.assignNone')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function NoteForm({ code }: { code: string }) {
  const { pending, error, run } = useAction();
  const [body, setBody] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          await run(
            `/api/reports/${code}/notes`,
            'POST',
            { body },
            translate('backoffice.report.noteAdded'),
          )
        ) {
          setBody('');
        }
      }}
    >
      <Field label={translate('backoffice.report.noteLabel')} error={error ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="outline" disabled={pending || body.trim().length < 2}>
        {translate('backoffice.report.addNote')}
      </Button>
    </form>
  );
}

export function MergeForm({ code, suggestions }: { code: string; suggestions: string[] }) {
  const { pending, error, run } = useAction();
  const [primaryCode, setPrimaryCode] = useState(suggestions[0] ?? '');
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          `/api/reports/${code}/merge`,
          'POST',
          { primaryCode },
          translate('backoffice.report.merged'),
        );
      }}
    >
      <p className="text-muted text-sm">{translate('backoffice.report.mergeLead')}</p>
      <Field label={translate('backoffice.report.mergeInto')} error={error ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <>
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              list={`${id}-suggestions`}
              placeholder="BA-…"
              value={primaryCode}
              onChange={(e) => setPrimaryCode(e.target.value.toUpperCase())}
            />
            <datalist id={`${id}-suggestions`}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Button type="submit" variant="outline" disabled={pending || primaryCode.length < 8}>
        {translate('backoffice.report.merge')}
      </Button>
    </form>
  );
}
