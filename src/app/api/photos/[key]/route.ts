import { apiError } from '@/lib/api/errors';
import { photoStorage } from '@/lib/photos/storage';

/** GET /api/photos/:key – photo déjà nettoyée de ses métadonnées (D-024). */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await photoStorage.read(key);
  if (!data) return apiError('NOT_FOUND', 'Photo introuvable.');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
