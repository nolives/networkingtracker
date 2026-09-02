import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ErrorBanner, Spinner } from '@/components/ui/feedback';
import { ApiError, PRIORITIES, type Contact, type ContactDraft } from '@/types';

const EMPTY: ContactDraft = {
  name: '',
  company: '',
  role: '',
  where_met: '',
  notes: '',
  priority: 'medium',
};

function toDraft(contact: Contact | null): ContactDraft {
  if (!contact) return EMPTY;
  return {
    name: contact.name,
    company: contact.company ?? '',
    role: contact.role ?? '',
    where_met: contact.where_met ?? '',
    notes: contact.notes ?? '',
    priority: contact.priority,
  };
}

/**
 * Create/edit form. It does no validation of its own beyond marking required
 * fields: the backend is the authority, and its per-field errors are rendered
 * inline here. That keeps one set of rules rather than two that can drift.
 */
export function ContactForm({
  contact,
  onSubmit,
}: {
  contact: Contact | null;
  onSubmit: (draft: ContactDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(() => toDraft(contact));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(toDraft(contact));
    setFormError(null);
    setFieldErrors({});
  }, [contact]);

  function set<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFieldErrors(({ [key]: _removed, ...rest }) => rest);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await onSubmit(draft);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.byField);
      } else {
        setFormError('Could not save this contact.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    // noValidate: the browser's own bubble would pre-empt the server's message,
    // so an invalid submit reaches the backend and shows its real error.
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <Field label="Name" htmlFor="c-name" error={fieldErrors.name}>
        <Input
          id="c-name"
          value={draft.name}
          invalid={Boolean(fieldErrors.name)}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ada Lovelace"
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="c-company" error={fieldErrors.company}>
          <Input
            id="c-company"
            value={draft.company}
            invalid={Boolean(fieldErrors.company)}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Neon"
          />
        </Field>

        <Field label="Role" htmlFor="c-role" error={fieldErrors.role}>
          <Input
            id="c-role"
            value={draft.role}
            invalid={Boolean(fieldErrors.role)}
            onChange={(e) => set('role', e.target.value)}
            placeholder="Engineering Manager"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Where you met"
          htmlFor="c-where"
          error={fieldErrors.where_met}
        >
          <Input
            id="c-where"
            value={draft.where_met}
            invalid={Boolean(fieldErrors.where_met)}
            onChange={(e) => set('where_met', e.target.value)}
            placeholder="Berkeley career fair"
          />
        </Field>

        <Field label="Priority" htmlFor="c-priority" error={fieldErrors.priority}>
          <Select
            id="c-priority"
            value={draft.priority}
            invalid={Boolean(fieldErrors.priority)}
            onChange={(e) =>
              set('priority', e.target.value as ContactDraft['priority'])
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="c-notes" error={fieldErrors.notes}>
        <Textarea
          id="c-notes"
          value={draft.notes}
          invalid={Boolean(fieldErrors.notes)}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Talked about graduate research; follow up in October."
        />
      </Field>

      {formError && <ErrorBanner message={formError} />}

      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Spinner />}
          {contact ? 'Save changes' : 'Add contact'}
        </Button>
      </div>
    </form>
  );
}
