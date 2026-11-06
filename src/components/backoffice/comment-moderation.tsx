'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

type Comment = {
  id: string;
  body: string;
  status: 'PUBLISHED' | 'HIDDEN';
  author: string;
  createdAt: string;
};

/** Commentaires publics vus du back-office, avec masquage et rétablissement. */
export function CommentModeration({
  comments,
  canModerate,
}: {
  comments: Comment[];
  canModerate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(comment: Comment) {
    setPending(comment.id);
    const response = await fetch(`/api/comments/${comment.id}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: comment.status === 'PUBLISHED' }),
    }).catch(() => null);
    setPending(null);
    if (response?.ok) {
      toast(translate('backoffice.moderation.done'));
      router.refresh();
    } else {
      toast(translate('design.errorBody'), 'error');
    }
  }

  return (
    <ul className="space-y-2">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className={cn(
            'rounded-card border-line bg-surface-raised border p-3',
            comment.status === 'HIDDEN' && 'opacity-70',
          )}
        >
          <p className="whitespace-pre-line">{comment.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted text-xs">
              {comment.author} · {comment.createdAt}
            </span>
            {comment.status === 'HIDDEN' && (
              <Badge tone="neutral">{translate('comments.hidden')}</Badge>
            )}
            {canModerate && (
              <Button
                variant="ghost"
                disabled={pending === comment.id}
                onClick={() => toggle(comment)}
              >
                {translate(comment.status === 'PUBLISHED' ? 'comments.hide' : 'comments.restore')}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
