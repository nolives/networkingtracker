import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Radix Dialog handles focus trapping, Escape, scroll locking, and the
 * aria-modal wiring -- the accessibility details that are easy to get wrong by
 * hand. On small screens the panel is bottom-anchored so it sits near the
 * thumb; on larger screens it centres.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden bg-surface shadow-xl',
          'inset-x-0 bottom-0 rounded-t-2xl border-t',
          'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="grid gap-1">
            <DialogPrimitive.Title className="text-base font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="rounded-md p-1 text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogClose = DialogPrimitive.Close;
