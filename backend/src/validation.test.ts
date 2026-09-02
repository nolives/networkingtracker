import { describe, expect, it } from 'vitest';
import {
  createContactSchema,
  updateContactSchema,
  toFieldErrors,
} from './validation.js';

/**
 * These tests run with no network and no credentials, so `npm test` is green
 * on a fresh clone. They cover the two rules the assignment calls out --
 * names must not be empty, priority must be one of three values -- plus the
 * ownership rule that makes RLS unspoofable from the client.
 */

describe('createContactSchema — name is required', () => {
  it('rejects an empty name', () => {
    const result = createContactSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)).toContainEqual({
      field: 'name',
      message: 'Name is required.',
    });
  });

  it('rejects a whitespace-only name', () => {
    const result = createContactSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)[0].message).toBe('Name is required.');
  });

  it('rejects a missing name', () => {
    expect(createContactSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a name longer than 200 characters', () => {
    const result = createContactSchema.safeParse({ name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)[0].message).toMatch(/200 characters/);
  });

  it('trims surrounding whitespace from a valid name', () => {
    const result = createContactSchema.safeParse({ name: '  Ada Lovelace  ' });
    expect(result.success).toBe(true);
    expect(result.data!.name).toBe('Ada Lovelace');
  });
});

describe('createContactSchema — priority is constrained', () => {
  it.each(['high', 'medium', 'low'])('accepts %s', (priority) => {
    const result = createContactSchema.safeParse({ name: 'Ada', priority });
    expect(result.success).toBe(true);
    expect(result.data!.priority).toBe(priority);
  });

  it('rejects a priority outside the allowed set', () => {
    const result = createContactSchema.safeParse({
      name: 'Ada',
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)[0].message).toMatch(
      /'high', 'medium', or 'low'/
    );
  });

  it('rejects a priority with the wrong casing', () => {
    expect(
      createContactSchema.safeParse({ name: 'Ada', priority: 'HIGH' }).success
    ).toBe(false);
  });

  it("defaults to 'medium' when omitted", () => {
    const result = createContactSchema.safeParse({ name: 'Ada' });
    expect(result.success).toBe(true);
    expect(result.data!.priority).toBe('medium');
  });
});

describe('ownership cannot be supplied by the client', () => {
  it('strips a user_id smuggled into a create payload', () => {
    const result = createContactSchema.safeParse({
      name: 'Ada',
      user_id: 'some-other-users-id',
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('user_id');
  });

  it('strips a user_id smuggled into an update payload', () => {
    const result = updateContactSchema.safeParse({
      name: 'Ada',
      user_id: 'some-other-users-id',
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('user_id');
  });

  it('strips an id, so a row cannot be re-pointed', () => {
    const result = createContactSchema.safeParse({ name: 'Ada', id: 'forged' });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('id');
  });
});

describe('updateContactSchema — partial but still validated', () => {
  it('accepts a single valid field', () => {
    const result = updateContactSchema.safeParse({ company: 'Neon' });
    expect(result.success).toBe(true);
  });

  it('still rejects an empty name on edit', () => {
    expect(updateContactSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('still rejects an invalid priority on edit', () => {
    expect(updateContactSchema.safeParse({ priority: 'urgent' }).success).toBe(
      false
    );
  });

  it('rejects an empty payload', () => {
    const result = updateContactSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('optional fields normalise to null', () => {
  it('converts empty strings to null rather than storing ""', () => {
    const result = createContactSchema.safeParse({
      name: 'Ada',
      company: '',
      notes: '   ',
    });
    expect(result.success).toBe(true);
    expect(result.data!.company).toBeNull();
    expect(result.data!.notes).toBeNull();
  });
});
