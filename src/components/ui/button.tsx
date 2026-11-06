import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

// Bouton du design system (style shadcn/ui, personnalisé). Hauteur minimale 48 px.
export const buttonVariants = cva(
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-control px-5 font-heading text-base font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary-light',
        secondary: 'bg-accent text-accent-foreground shadow-soft hover:brightness-95',
        outline: 'border-2 border-primary bg-surface-raised text-primary hover:bg-surface',
        ghost: 'text-ink hover:bg-line/60',
        danger: 'bg-danger text-danger-foreground shadow-soft hover:brightness-95',
      },
      size: {
        md: 'min-h-touch',
        lg: 'min-h-14 px-6 text-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
});
