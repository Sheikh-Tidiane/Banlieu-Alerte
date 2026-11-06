import { CircleEllipsis, Droplets, Grid3x3, RouteOff, Trash } from 'lucide-react';
import type { ReportType } from '@/validators/report';

/** Pictogrammes compréhensibles sans lecture (DESIGN_ET_MARQUE §1), toujours avec un libellé. */
export const reportTypeIcons: Record<ReportType, React.ElementType> = {
  FLOODING: Droplets,
  BLOCKED_DRAIN: Grid3x3,
  WASTE_DUMP: Trash,
  ROAD_CUT: RouteOff,
  OTHER: CircleEllipsis,
};

export function ReportTypeIcon({ type, className }: { type: ReportType; className?: string }) {
  const Icon = reportTypeIcons[type];
  return <Icon aria-hidden="true" className={className} />;
}
