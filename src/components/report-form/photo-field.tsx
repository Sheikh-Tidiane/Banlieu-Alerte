'use client';

import { Camera, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { compressPhoto } from '@/lib/photos/compress-client';
import { translate } from '@/i18n';

type Props = { value: Blob | null; onChange: (photo: Blob | null) => void };

/** Photo facultative : prise depuis l'appareil, compressée avant l'envoi. */
export function PhotoField({ value, onChange }: Props) {
  const id = useId();
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus('processing');
    try {
      onChange(await compressPhoto(file));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="space-y-2">
      <p className="font-medium">{translate('reportForm.photoTitle')}</p>
      {preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
          <img
            src={preview}
            alt=""
            className="rounded-card border-line max-h-48 border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="size-touch bg-surface-raised text-ink shadow-soft rounded-pill absolute top-2 right-2 grid place-items-center"
            aria-label={translate('reportForm.photoRemove')}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="min-h-touch rounded-control border-line bg-surface-raised text-primary hover:border-primary flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed px-4 py-4 font-semibold"
        >
          <Camera aria-hidden="true" className="size-5" />
          {status === 'processing'
            ? translate('reportForm.photoProcessing')
            : translate('reportForm.photoAdd')}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {status === 'error' && (
        <p role="alert" className="text-danger text-sm font-medium">
          {translate('reportForm.photoError')}
        </p>
      )}
    </div>
  );
}
