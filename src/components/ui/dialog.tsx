'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Modale basée sur l'élément natif <dialog> : piège du focus, touche Échap et
 * fond assombri fournis par le navigateur, sans dépendance supplémentaire.
 */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Identifiant propre à chaque modale : plusieurs modales coexistent dans la page.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={cn(
        'rounded-card border-line bg-surface-raised text-ink shadow-raised m-auto w-[calc(100%-2rem)] max-w-md border p-0',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-0">
        <h2 id={titleId} className="font-heading text-xl font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={translate('common.close')}
          className="size-touch rounded-control text-muted hover:bg-line/60 -mt-2 -mr-2 grid shrink-0 place-items-center"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="border-line flex justify-end gap-3 border-t p-4">{footer}</div>}
    </dialog>
  );
}
