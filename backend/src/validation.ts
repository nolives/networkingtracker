import { z } from 'zod';

/**
 * The trust boundary. Every request body crosses this before the backend will
 * touch the database, and these schemas are what backend/src/validation.test.ts
 * exercises.
 *
 * Note what is absent: `user_id`. Ownership is never accepted from client
 * input. It comes from the verified JWT and the column's auth.user_id()
 * default, so a caller cannot create or move a row into someone else's account
 * no matter what they post. Zod's default object parsing strips unknown keys,
 * which is what makes that stripping automatic.
 */

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

const name = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(1, 'Name is required.')
  .max(200, 'Name must be 200 characters or fewer.');

const priority = z.enum(PRIORITIES, {
  error: "Priority must be one of 'high', 'medium', or 'low'.",
});

/** Optional free-text field: '' and whitespace normalise to null, not ''. */
const optionalText = (label: string, max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v));

/** Shared field definitions, so create and update cannot drift apart. */
const contactFields = {
  name,
  company: optionalText('Company', 200),
  role: optionalText('Role', 200),
  where_met: optionalText('Where met', 200),
  notes: optionalText('Notes'),
};

export const createContactSchema = z.object({
  ...contactFields,
  // Only the create schema defaults priority; see updateContactSchema below.
  priority: priority.default('medium'),
});

/**
 * Edits are partial, but any field that IS present must still be valid --
 * so `{ name: '' }` is rejected rather than silently ignored.
 * `.strict()` is not used, because unknown keys (including a smuggled
 * `user_id`) are stripped rather than treated as an error.
 */
/**
 * Deliberately built from `contactFields` rather than `createContactSchema
 * .partial()`. Reusing the create schema would carry over priority's
 * `.default('medium')`, which survives `.partial()` -- so an empty PATCH body
 * would parse to `{ priority: 'medium' }`, quietly pass the "no fields to
 * update" guard below, and rewrite the user's priority to medium.
 */
export const updateContactSchema = z
  .object({ ...contactFields, priority })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'No fields to update.',
  });

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export interface FieldError {
  field: string;
  message: string;
}

/** Flattens a ZodError into a shape the React form can render inline. */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '_',
    message: issue.message,
  }));
}
