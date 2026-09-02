import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-ink hover:opacity-90',
        outline: 'border border-border bg-surface text-ink hover:bg-canvas',
        ghost: 'text-muted hover:bg-canvas hover:text-ink',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        // 44px min touch target on mobile.
        md: 'h-11 px-4 sm:h-9',
        sm: 'h-9 px-3 text-sm sm:h-8',
        icon: 'h-11 w-11 sm:h-9 sm:w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
