import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/cn';

const controlClass =
  'block w-full min-h-touch rounded-control border-2 border-line bg-surface-raised px-4 py-3 text-base text-ink placeholder:text-muted transition-colors focus:border-water focus:outline-none aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlClass, 'min-h-28', className)} {...props} />;
});

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
};

/** Champ de formulaire : étiquette, aide et message d'erreur reliés au contrôle (ARIA). */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-ink block font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
