import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  DataApiError,
  deleteContact,
  getContact,
  insertContact,
  listContacts,
  updateContact,
} from '../dataApi.js';
import {
  createContactSchema,
  toFieldErrors,
  updateContactSchema,
} from '../validation.js';

export const contactsRouter = Router();

// Every route below requires a verified JWT.
contactsRouter.use(requireAuth);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maps PostgREST/Postgres errors to messages a user can act on. */
function mapDataApiError(error: DataApiError): {
  status: number;
  body: Record<string, unknown>;
} {
  // 23514 = check_violation. The database rejected it even though Zod passed,
  // which means the two validation layers disagree -- surface it plainly.
  if (error.code === '23514') {
    const isPriority = error.message.includes('priority');
    return {
      status: 400,
      body: {
        error: isPriority
          ? "Priority must be one of 'high', 'medium', or 'low'."
          : 'Name is required.',
      },
    };
  }

  // 42501 = insufficient_privilege: an RLS policy refused the write.
  if (error.code === '42501') {
    return { status: 403, body: { error: 'You do not have access to that contact.' } };
  }

  if (error.status === 401 || error.status === 403) {
    return { status: 403, body: { error: 'You do not have access to that contact.' } };
  }

  return { status: 502, body: { error: 'The database request failed.' } };
}

/** GET /api/contacts — the caller's own contacts, newest first. */
contactsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ contacts: await listContacts(req.accessToken!) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/contacts */
contactsRouter.post('/', async (req, res, next) => {
  const parsed = createContactSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Please correct the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error),
    });
    return;
  }

  try {
    // parsed.data contains only known fields; any client-supplied user_id or
    // id was stripped by Zod before reaching here.
    const rows = await insertContact(req.accessToken!, parsed.data);

    if (rows.length === 0) {
      res.status(403).json({ error: 'The contact could not be created.' });
      return;
    }

    res.status(201).json({ contact: rows[0] });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/contacts/:id */
contactsRouter.patch('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'That contact id is not valid.' });
    return;
  }

  const parsed = updateContactSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Please correct the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error),
    });
    return;
  }

  try {
    const rows = await updateContact(req.accessToken!, id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

    // Zero rows means RLS filtered the row out: it belongs to someone else, or
    // does not exist. Both are reported identically so the response cannot be
    // used to probe whether another user's contact id exists.
    if (rows.length === 0) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    res.json({ contact: rows[0] });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/contacts/:id */
contactsRouter.delete('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'That contact id is not valid.' });
    return;
  }

  try {
    const rows = await deleteContact(req.accessToken!, id);

    // Same reasoning as PATCH: a delete that matched nothing is a 404, never a
    // silent success.
    if (rows.length === 0) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    res.json({ deleted: rows[0].id });
  } catch (error) {
    next(error);
  }
});

/** GET /api/contacts/:id */
contactsRouter.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'That contact id is not valid.' });
    return;
  }

  try {
    const rows = await getContact(req.accessToken!, id);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    res.json({ contact: rows[0] });
  } catch (error) {
    next(error);
  }
});

export { mapDataApiError };
