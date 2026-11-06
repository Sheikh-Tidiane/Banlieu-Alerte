'use client';

import { CheckCheck, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

/** Suppression d'un abonnement par son titulaire. */
export function DeleteSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const response = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' }).catch(
      () => null,
    );
    setPending(false);
    toast(response?.ok ? translate('subscribe.deleted') : translate('design.errorBody'));
    if (response?.ok) router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={remove} disabled={pending}>
      <Trash aria-hidden="true" />
      {translate('subscribe.delete')}
    </Button>
  );
}

export function MarkNotificationsReadButton({
  endpoint = '/api/account/notifications',
}: {
  endpoint?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function markRead() {
    setPending(true);
    const response = await fetch(endpoint, { method: 'POST' }).catch(() => null);
    setPending(false);
    if (response?.ok) router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={markRead} disabled={pending}>
      <CheckCheck aria-hidden="true" />
      {translate('subscribe.markRead')}
    </Button>
  );
}
