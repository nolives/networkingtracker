import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-lg border bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 transition-colors sm:text-sm disabled:opacity-50';

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-medium text-ink', className)}
      {...props}
    />
  );
}

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(control, invalid && 'border-danger', className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(control, 'min-h-20 resize-y', invalid && 'border-danger', className)}
      {...props}
    />
  );
}

/**
 * A native <select> rather than a custom listbox: on mobile it opens the OS
 * picker, which is both more accessible and better on small screens than
 * anything hand-rolled.
 */
export function Select({
  className,
  invalid,
  ...props
}: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(control, 'h-11 appearance-none sm:h-9', invalid && 'border-danger', className)}
      {...props}
    />
  );
}

/** Groups a label, its control, and an inline error message. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
