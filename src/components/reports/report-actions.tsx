'use client';

import { Flag, Share2, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { getDeviceId } from '@/lib/offline/device';
import { translate } from '@/i18n';

type Props = { trackingCode: string; initialCount: number };

/** « Je vois aussi ce problème », partage et signalement d'abus. */
export function ReportActions({ trackingCode, initialCount }: Props) {
  const toast = useToast();
  const [count, setCount] = useState(initialCount);
  const [voting, setVoting] = useState(false);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [abuseOpen, setAbuseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [abuseError, setAbuseError] = useState<string>();
  const [sendingAbuse, setSendingAbuse] = useState(false);

  async function confirm() {
    setVoting(true);
    try {
      const response = await fetch(`/api/reports/${trackingCode}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      const body = (await response.json()) as {
        data?: { confirmed: boolean; alreadyConfirmed: boolean; confirmationCount: number };
      };
      if (!response.ok || !body.data) throw new Error();
      setCount(body.data.confirmationCount);
      setVoteMessage(
        translate(body.data.alreadyConfirmed ? 'detail.alreadyConfirmed' : 'detail.confirmed'),
      );
    } catch {
      toast(translate('detail.confirmError'), 'error');
    } finally {
      setVoting(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: translate('app.name'), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast(translate('detail.copied'));
      }
    } catch {
      // Partage annulé par l'habitant : rien à signaler.
    }
  }

  async function sendAbuse() {
    setSendingAbuse(true);
    setAbuseError(undefined);
    try {
      const response = await fetch(`/api/reports/${trackingCode}/abuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json()) as {
        error?: { message: string; details?: Record<string, string[]> };
      };
      if (!response.ok) {
        setAbuseError(
          body.error?.details?.reason?.[0] ?? body.error?.message ?? translate('detail.abuseError'),
        );
        return;
      }
      setAbuseOpen(false);
      setReason('');
      toast(translate('detail.abuseSent'));
    } catch {
      setAbuseError(translate('detail.abuseError'));
    } finally {
      setSendingAbuse(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="lg" fullWidth disabled={voting || voteMessage !== null} onClick={confirm}>
        <ThumbsUp aria-hidden="true" />
        {translate('detail.confirm')}
        <span
          className="rounded-pill bg-primary-foreground/20 px-2 text-sm"
          aria-label={`${count} ${translate('map.confirmations')}`}
        >
          {count}
        </span>
      </Button>
      {voteMessage && (
        <p role="status" className="text-safe text-sm font-medium">
          {voteMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={share}>
          <Share2 aria-hidden="true" />
          {translate('detail.share')}
        </Button>
        <Button variant="ghost" onClick={() => setAbuseOpen(true)}>
          <Flag aria-hidden="true" />
          {translate('detail.abuse')}
        </Button>
      </div>
      <Dialog
        open={abuseOpen}
        onClose={() => setAbuseOpen(false)}
        title={translate('detail.abuseTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbuseOpen(false)}>
              {translate('common.cancel')}
            </Button>
            <Button variant="primary" disabled={sendingAbuse} onClick={sendAbuse}>
              {translate('detail.abuseSend')}
            </Button>
          </>
        }
      >
        <p className="mb-4">{translate('detail.abuseLead')}</p>
        <Field label={translate('detail.abuseReason')} error={abuseError}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
