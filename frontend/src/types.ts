export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  where_met: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

export type ContactDraft = {
  name: string;
  company: string;
  role: string;
  where_met: string;
  notes: string;
  priority: Priority;
};

export interface FieldError {
  field: string;
  message: string;
}

/** Thrown by the api layer; carries per-field messages for inline display. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: FieldError[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by field name, for rendering under each input. */
  get byField(): Record<string, string> {
    return Object.fromEntries(
      this.fieldErrors.map(({ field, message }) => [field, message])
    );
  }
}
