import { CircleCheck, CloudAlert, Inbox, Info, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Squelette de chargement (respecte prefers-reduced-motion via globals.css). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('rounded-control bg-line animate-pulse', className)} />
  );
}

type StateProps = {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Liste vide illustrée. `headingLevel` : 2 quand l'état vide suit directement le titre de page. */
export function EmptyState({
  title,
  body,
  action,
  className,
  headingLevel = 3,
}: StateProps & { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn(
        'rounded-card border-line bg-surface-raised flex flex-col items-center border-2 border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <span className="rounded-pill bg-water/10 text-water mb-4 grid size-16 place-items-center">
        <Inbox aria-hidden="true" className="size-8" />
      </span>
      <Heading className="font-heading text-lg font-semibold">{title}</Heading>
      {body && <p className="text-muted mt-2 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const bannerStyles = {
  info: { icon: Info, className: 'border-water/40 bg-water/10 [&>svg]:text-water', role: 'status' },
  error: {
    icon: CloudAlert,
    className: 'border-danger/40 bg-danger/10 [&>svg]:text-danger',
    role: 'alert',
  },
  success: {
    icon: CircleCheck,
    className: 'border-safe/40 bg-safe/10 [&>svg]:text-safe',
    role: 'status',
  },
  offline: {
    icon: WifiOff,
    className: 'border-ink/30 bg-line/60 [&>svg]:text-ink',
    role: 'status',
  },
  syncPending: {
    icon: RefreshCw,
    className: 'border-water/40 bg-water/10 [&>svg]:text-water',
    role: 'status',
  },
} as const;

export type BannerKind = keyof typeof bannerStyles;

/** Bandeau d'état : erreur, succès, hors-ligne, synchronisation en attente. */
export function StateBanner({
  kind,
  title,
  body,
  action,
  className,
}: StateProps & { kind: BannerKind }) {
  const { icon: Icon, className: style, role } = bannerStyles[kind];
  return (
    <div
      role={role}
      className={cn('rounded-card text-ink flex gap-3 border p-4', style, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {body && <p className="mt-0.5 text-sm">{body}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
