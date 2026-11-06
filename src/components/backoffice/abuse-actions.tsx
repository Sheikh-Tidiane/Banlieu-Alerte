'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

type Props = {
  flagId: string;
  commentId: string | null;
  reportCode: string | null;
  canReject: boolean;
  canBlock: boolean;
};

/** Actions de modération sur un signalement d'abus. */
export function AbuseActions({ flagId, commentId, reportCode, canReject, canBlock }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function act(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    setPending(true);
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setPending(false);
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    if (response?.ok) {
      toast(translate('backoffice.moderation.done'));
      router.refresh();
    } else {
      toast(payload?.error?.message ?? translate('design.errorBody'), 'error');
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => act(`/api/abuse/${flagId}/dismiss`, 'POST')}
      >
        {translate('backoffice.moderation.dismiss')}
      </Button>
      {commentId && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => act(`/api/comments/${commentId}/hide`, 'POST', { hidden: true })}
        >
          {translate('backoffice.moderation.hideComment')}
        </Button>
      )}
      {reportCode && canReject && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            act(`/api/reports/${reportCode}/status`, 'PATCH', {
              status: 'REJECTED',
              reason: 'Rejeté après signalement d’abus',
            })
          }
        >
          {translate('backoffice.moderation.rejectReport')}
        </Button>
      )}
      {commentId && canBlock && (
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => act(`/api/abuse/${flagId}/block-author`, 'POST')}
        >
          {translate('backoffice.moderation.blockAuthor')}
        </Button>
      )}
    </div>
  );
}
