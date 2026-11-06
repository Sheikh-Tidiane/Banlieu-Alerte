'use client';

import { Flag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import type { PublicComment } from '@/services/reports/comments';
import { translate } from '@/i18n';

const formatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

function authorLabel(role: PublicComment['authorRole']) {
  return !role || role === 'CITIZEN' ? translate('comments.anonymous') : translate(`roles.${role}`);
}

/** Commentaires publics : publiés tout de suite pour un compte connecté, signalables. */
export function Comments({ code, initial }: { code: string; initial: PublicComment[] }) {
  const toast = useToast();
  const [comments, setComments] = useState(initial);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data: unknown }>)
      .then((payload) => setLoggedIn(payload.data !== null))
      .catch(() => setLoggedIn(false));
  }, []);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/reports/${code}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const payload = (await response.json()) as {
        data?: PublicComment;
        error?: { message: string; details?: Record<string, string[]> };
      };
      if (!response.ok || !payload.data) {
        setError(
          payload.error?.details?.body?.[0] ??
            payload.error?.message ??
            translate('design.errorBody'),
        );
        return;
      }
      setComments((current) => [...current, payload.data!]);
      setBody('');
      toast(translate('comments.published'));
    } catch {
      setError(translate('design.errorBody'));
    } finally {
      setSending(false);
    }
  }

  async function report(commentId: string) {
    const response = await fetch(`/api/comments/${commentId}/abuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Commentaire signalé par un habitant' }),
    }).catch(() => null);
    toast(
      translate(response?.ok ? 'comments.reported' : 'design.errorBody'),
      response?.ok ? 'success' : 'error',
    );
  }

  return (
    <section aria-labelledby="comments" className="space-y-4">
      <h2 id="comments" className="text-xl font-semibold">
        {translate('comments.title')}
      </h2>
      {comments.length === 0 ? (
        <p className="text-muted">{translate('comments.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-card border-line bg-surface-raised border p-4">
              <p className="whitespace-pre-line">{comment.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted text-sm">
                  {authorLabel(comment.authorRole)} ·{' '}
                  {formatter.format(new Date(comment.createdAt))}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => report(comment.id)}
                  aria-label={`${translate('comments.report')} : ${comment.body.slice(0, 40)}`}
                >
                  <Flag aria-hidden="true" />
                  {translate('comments.report')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {loggedIn === false && (
        <p>
          <Link
            href={`/connexion?suite=/signalements/${code}`}
            className="text-primary font-semibold underline"
          >
            {translate('comments.loginToComment')}
          </Link>
        </p>
      )}
      {loggedIn && (
        <form onSubmit={publish} className="space-y-3">
          <Field
            label={translate('comments.label')}
            hint={translate('comments.hint')}
            error={error}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                maxLength={1000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={sending || body.trim().length < 2}>
            {translate('comments.submit')}
          </Button>
        </form>
      )}
    </section>
  );
}
