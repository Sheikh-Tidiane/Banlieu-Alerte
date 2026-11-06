'use client';

// Compression côté navigateur (D-024) : réduit le volume envoyé en 3G et, en
// redessinant l'image, élimine déjà ses métadonnées. Le serveur ré-encode de toute façon.

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;

export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible'))),
      'image/jpeg',
      QUALITY,
    );
  });
}
