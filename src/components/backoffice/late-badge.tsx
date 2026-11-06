import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { translate } from '@/i18n';

/** Signalement escaladé (D-056) : « En retard », avec l'échelon atteint. */
export function LateBadge({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <Badge
      tone="warning"
      title={translate(level >= 2 ? 'escalation.lateLevel2' : 'escalation.lateLevel1')}
    >
      <Clock aria-hidden="true" />
      {translate('escalation.late')}
    </Badge>
  );
}
