import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

// Format d'erreur homogène pour toutes les API (CDC §10).
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; details?: Record<string, string[]> };
};

export function apiError(code: ApiErrorCode, message: string, details?: Record<string, string[]>) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status: statusByCode[code] });
}

/** Convertit une erreur Zod en réponse 400, champ par champ. */
export function validationError(error: ZodError) {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    (details[path] ??= []).push(issue.message);
  }
  return apiError('VALIDATION_ERROR', 'Les données envoyées sont invalides.', details);
}
