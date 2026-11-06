import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { mutation } from '@/lib/api/route';
import { PHOTO_MAX_BYTES } from '@/lib/photos/process';
import { requireUser } from '@/permissions/require';
import { addCleanupPhoto } from '@/services/cleanup/cleanup';

type Context = { params: Promise<{ id: string }> };

/** POST /api/cleanup/:id/photos – photo avant ou après (EXIF retiré, D-024). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const form = await request.formData().catch(() => null);
    if (!form) return apiError('VALIDATION_ERROR', 'Formulaire illisible.');
    const phase = form.get('phase');
    const file = form.get('photo');
    if (phase !== 'BEFORE' && phase !== 'AFTER') {
      return apiError('VALIDATION_ERROR', 'Étape attendue : BEFORE ou AFTER.');
    }
    if (!(file instanceof File) || file.size === 0) {
      return apiError('VALIDATION_ERROR', 'Photo manquante.', { photo: ['Photo manquante.'] });
    }
    if (file.size > PHOTO_MAX_BYTES) {
      return apiError('VALIDATION_ERROR', 'Photo trop lourde (5 Mo maximum).');
    }
    const { id } = await params;
    const saved = await addCleanupPhoto(user, id, phase, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: saved }, { status: 201 });
  });
}
