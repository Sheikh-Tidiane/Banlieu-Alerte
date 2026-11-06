'use client';

import { CircleCheck, CloudAlert, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

const toneStyles: Record<ToastTone, { icon: React.ElementType; className: string }> = {
  success: { icon: CircleCheck, className: '[&>svg]:text-safe' },
  error: { icon: CloudAlert, className: '[&>svg]:text-danger' },
  info: { icon: Info, className: '[&>svg]:text-water' },
};

const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = toneStyles[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'rounded-card border-line bg-surface-raised text-ink shadow-raised pointer-events-auto flex w-full max-w-sm items-center gap-3 border py-2 pr-2 pl-4',
                className,
              )}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={translate('common.close')}
                className="size-touch rounded-control text-muted hover:bg-line/60 grid shrink-0 place-items-center"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast doit être utilisé dans un ToastProvider.');
  return show;
}
