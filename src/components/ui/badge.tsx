import { cva, type VariantProps } from 'class-variance-authority';
import {
  CircleCheck,
  CircleQuestionMark,
  CircleDot,
  FlaskConical,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Wrench,
  CircleX,
  OctagonAlert,
} from 'lucide-react';
import { translate, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm font-medium [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface text-ink',
        primary: 'border-primary/30 bg-primary/10 text-primary',
        water: 'border-water/30 bg-water/10 text-ink',
        accent: 'border-accent bg-accent/25 text-ink',
        warning: 'border-warning bg-warning/15 text-ink',
        danger: 'border-danger/40 bg-danger/10 text-ink',
        safe: 'border-safe/40 bg-safe/10 text-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Niveaux de risque (CDC §5.4). Couleur + icône + texte, jamais la couleur seule. */
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'limitedData';

const riskStyles: Record<RiskLevel, { className: string; icon: React.ElementType }> = {
  low: { className: 'border-risk-low bg-risk-low/10 [&_svg]:text-risk-low', icon: ShieldCheck },
  moderate: {
    className: 'border-risk-moderate bg-risk-moderate/20 [&_svg]:text-ink',
    icon: CircleDot,
  },
  high: {
    className: 'border-risk-high bg-risk-high/15 [&_svg]:text-risk-high',
    icon: TriangleAlert,
  },
  critical: {
    className: 'border-risk-critical bg-risk-critical/10 [&_svg]:text-risk-critical',
    icon: OctagonAlert,
  },
  limitedData: {
    className: 'border-dashed border-muted bg-surface [&_svg]:text-muted',
    icon: CircleQuestionMark,
  },
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const { className: style, icon: Icon } = riskStyles[level];
  return (
    <span className={cn(badgeVariants(), 'text-ink', style, className)}>
      <Icon aria-hidden="true" />
      {translate(`risk.${level}`)}
    </span>
  );
}

/** Statuts de signalement (CDC §4.3). */
export type ReportStatus =
  'NEW' | 'VERIFIED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

const statusStyles: Record<
  ReportStatus,
  { tone: NonNullable<BadgeProps['tone']>; icon: React.ElementType }
> = {
  NEW: { tone: 'water', icon: TriangleAlert },
  VERIFIED: { tone: 'primary', icon: CircleCheck },
  ASSIGNED: { tone: 'accent', icon: UserCheck },
  IN_PROGRESS: { tone: 'warning', icon: Wrench },
  RESOLVED: { tone: 'safe', icon: CircleCheck },
  REJECTED: { tone: 'neutral', icon: CircleX },
};

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const { tone, icon: Icon } = statusStyles[status];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden="true" />
      {translate(`reportStatus.${status}` as TranslationKey)}
    </Badge>
  );
}

/** Mention obligatoire sur toute donnée fictive (EXG-16). */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="accent" className={className} title={translate('common.demoDataHint')}>
      <FlaskConical aria-hidden="true" />
      {translate('common.demoData')}
    </Badge>
  );
}
