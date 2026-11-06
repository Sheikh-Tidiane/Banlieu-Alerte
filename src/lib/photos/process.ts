import sharp from 'sharp';

// Traitement serveur des photos (D-024, EXG-13) : vrai type vérifié sur le contenu,
// taille bornée, ré-encodage en JPEG qui supprime toutes les métadonnées (EXIF, GPS).

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 1600;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class PhotoRejectedError extends Error {}

export type ProcessedPhoto = {
  data: Buffer;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
};

export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length === 0) throw new PhotoRejectedError('Photo vide.');
  if (input.length > PHOTO_MAX_BYTES)
    throw new PhotoRejectedError('Photo trop lourde (5 Mo maximum).');

  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new PhotoRejectedError('Ce fichier n’est pas une image valide.');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new PhotoRejectedError('Format non accepté (JPEG, PNG ou WebP).');
  }

  // rotate() applique l'orientation EXIF avant de la supprimer ; sharp n'écrit aucune
  // métadonnée tant que withMetadata() n'est pas appelé.
  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: PHOTO_MAX_DIMENSION,
      height: PHOTO_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, mimeType: 'image/jpeg' };
}
