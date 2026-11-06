import type { ApiErrorCode } from '@/lib/api/errors';

/** Erreur métier : traduite en réponse API homogène par les route handlers. */
export class ServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}
