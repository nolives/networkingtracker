import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names so a caller's utility can override a component's default
 * (e.g. passing `bg-danger` beats the built-in `bg-brand`) instead of the two
 * fighting in the class attribute. Standard shadcn/ui helper.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
