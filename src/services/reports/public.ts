import { roundCoordinate } from '@/lib/geo/distance';
import type { ReportStatus, ReportType, Severity } from '@/validators/report';

// Seule porte de sortie publique des signalements (EXG-06, EXG-39, D-025) :
// positions arrondies ; ni auteur, ni identifiant interne, ni note interne, ni contact.

export type PublicReportSummary = {
  trackingCode: string;
  type: ReportType;
  severity: Severity;
  status: ReportStatus;
  lat: number;
  lng: number;
  neighborhood: { id: string; name: string } | null;
  confirmationCount: number;
  createdAt: string;
  isDemo: boolean;
  hasPhoto: boolean;
};

export type PublicReportDetail = PublicReportSummary & {
  description: string | null;
  isApproximate: boolean;
  resolvedAt: string | null;
  photos: { url: string; width: number | null; height: number | null }[];
  /** `reopenedByResident` : l'habitant a répondu « non résolu » (EXG-32). */
  history: { status: ReportStatus; at: string; reopenedByResident?: boolean }[];
};

type Decimalish = { toString(): string } | number;

type SummarySource = {
  trackingCode: string;
  type: ReportType;
  severity: Severity;
  status: ReportStatus;
  lat: Decimalish;
  lng: Decimalish;
  neighborhood: { id: string; name: string } | null;
  confirmationCount: number;
  createdAt: Date;
  isDemo: boolean;
  _count?: { photos: number };
  photos?: unknown[];
};

type DetailSource = Omit<SummarySource, 'photos'> & {
  description: string | null;
  isApproximate: boolean;
  resolvedAt: Date | null;
  photos: { storageKey: string; width: number | null; height: number | null }[];
  authorId?: string | null;
  statusHistory: {
    fromStatus?: ReportStatus | null;
    toStatus: ReportStatus;
    createdAt: Date;
    changedById?: string | null;
  }[];
};

export function toPublicSummary(report: SummarySource): PublicReportSummary {
  return {
    trackingCode: report.trackingCode,
    type: report.type,
    severity: report.severity,
    status: report.status,
    lat: roundCoordinate(Number(report.lat.toString())),
    lng: roundCoordinate(Number(report.lng.toString())),
    neighborhood: report.neighborhood
      ? { id: report.neighborhood.id, name: report.neighborhood.name }
      : null,
    confirmationCount: report.confirmationCount,
    createdAt: report.createdAt.toISOString(),
    isDemo: report.isDemo,
    hasPhoto: (report._count?.photos ?? report.photos?.length ?? 0) > 0,
  };
}

export function toPublicDetail(report: DetailSource): PublicReportDetail {
  return {
    ...toPublicSummary(report),
    description: report.description,
    isApproximate: report.isApproximate,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    photos: report.photos.map((photo) => ({
      url: `/api/photos/${photo.storageKey}`,
      width: photo.width,
      height: photo.height,
    })),
    history: report.statusHistory.map((step) => ({
      status: step.toStatus,
      at: step.createdAt.toISOString(),
      ...(step.fromStatus === 'RESOLVED' &&
      step.toStatus === 'IN_PROGRESS' &&
      report.authorId &&
      step.changedById === report.authorId
        ? { reopenedByResident: true }
        : {}),
    })),
  };
}
