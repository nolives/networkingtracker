import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Skeleton rows: a loading state that hints at the shape of what's coming. */
export function TableSkeleton() {
  return (
    <div className="grid gap-2 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading contacts…</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-canvas"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div className="grid gap-1 text-sm">
        <p className="font-medium text-ink">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-fit text-xs font-medium text-danger underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Transient success confirmation, announced to screen readers. */
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex w-fit items-center gap-2 rounded-full border border-success/40 bg-surface px-4 py-2 text-sm font-medium text-ink shadow-lg sm:inset-x-auto sm:right-6"
    >
      <CheckCircle2 className="h-4 w-4 text-success" />
      {message}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

export function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-priority-high/12 text-priority-high border-priority-high/30',
    medium: 'bg-priority-medium/12 text-priority-medium border-priority-medium/30',
    low: 'bg-priority-low/12 text-priority-low border-priority-low/30',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        styles[priority]
      )}
    >
      {priority}
    </span>
  );
}
