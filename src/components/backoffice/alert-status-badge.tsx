import { Badge, type BadgeProps } from '@/components/ui/badge';
import { translate } from '@/i18n';

type AlertStatus =
  'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'SENT' | 'REJECTED' | 'CANCELLED';

const tones: Record<AlertStatus, NonNullable<BadgeProps['tone']>> = {
  PENDING_APPROVAL: 'accent',
  APPROVED: 'water',
  SCHEDULED: 'water',
  SENT: 'safe',
  REJECTED: 'neutral',
  CANCELLED: 'neutral',
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <Badge tone={tones[status]}>{translate(`backoffice.alerts.status.${status}`)}</Badge>;
}

export function AlertTypeBadge({ type }: { type: 'OFFICIAL' | 'INDICATIVE' }) {
  return (
    <Badge tone={type === 'OFFICIAL' ? 'danger' : 'water'}>
      {translate(type === 'OFFICIAL' ? 'alert.official' : 'alert.indicative')}
    </Badge>
  );
}
