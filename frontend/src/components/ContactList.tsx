import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/ui/feedback';
import type { Contact } from '@/types';

export type SortKey = 'name' | 'company' | 'priority' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

/** Priority sorts by urgency, not alphabetically ("high" < "low" in a-z). */
const PRIORITY_RANK: Record<Contact['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sorting and filtering run on the client, over the contacts already fetched.
 * A personal contact list is small, so this is instant -- and it keeps user
 * input out of any database query, so there is no sort-column allowlist to get
 * wrong.
 */
export function sortAndFilter(
  contacts: Contact[],
  { sort, priority, search }: { sort: Sort; priority: string; search: string }
): Contact[] {
  const needle = search.trim().toLowerCase();

  const filtered = contacts.filter((contact) => {
    if (priority !== 'all' && contact.priority !== priority) return false;
    if (!needle) return true;

    return [
      contact.name,
      contact.company,
      contact.role,
      contact.where_met,
      contact.notes,
    ].some((field) => field?.toLowerCase().includes(needle));
  });

  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    if (sort.key === 'priority') {
      return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * direction;
    }

    if (sort.key === 'created_at') {
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
        direction
      );
    }

    const left = (a[sort.key] ?? '').toLowerCase();
    const right = (b[sort.key] ?? '').toLowerCase();

    // Rows with no company sink to the bottom regardless of direction.
    if (!left && right) return 1;
    if (left && !right) return -1;

    return left.localeCompare(right) * direction;
  });
}

function SortButton({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th scope="col" className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-sort={
          active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        className="inline-flex items-center gap-1.5 py-3 text-xs font-semibold tracking-wide text-muted uppercase transition-colors hover:text-ink"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand' : 'opacity-50'}`} />
      </button>
    </th>
  );
}

export function ContactList({
  contacts,
  sort,
  onSort,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <>
      {/* Desktop: a real table, which is what this data is. */}
      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="border-b">
            <SortButton label="Name" column="name" sort={sort} onSort={onSort} className="px-5" />
            <SortButton label="Company" column="company" sort={sort} onSort={onSort} className="px-3" />
            <th scope="col" className="px-3 py-3 text-xs font-semibold tracking-wide text-muted uppercase">
              Where met
            </th>
            <SortButton label="Priority" column="priority" sort={sort} onSort={onSort} className="px-3" />
            <SortButton label="Added" column="created_at" sort={sort} onSort={onSort} className="px-3" />
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b last:border-0 hover:bg-canvas/60">
              <td className="px-5 py-3">
                <div className="font-medium text-ink">{contact.name}</div>
                {contact.role && (
                  <div className="text-sm text-muted">{contact.role}</div>
                )}
              </td>
              <td className="px-3 py-3 text-sm text-ink">{contact.company || '—'}</td>
              <td className="px-3 py-3 text-sm text-muted">{contact.where_met || '—'}</td>
              <td className="px-3 py-3">
                <PriorityBadge priority={contact.priority} />
              </td>
              <td className="px-3 py-3 text-sm whitespace-nowrap text-muted">
                {new Date(contact.created_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${contact.name}`}
                    onClick={() => onEdit(contact)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${contact.name}`}
                    onClick={() => onDelete(contact)}
                    className="hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: the same rows as cards, since a 6-column table cannot fit. */}
      <ul className="divide-y md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{contact.name}</p>
                <p className="truncate text-sm text-muted">
                  {[contact.role, contact.company].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <PriorityBadge priority={contact.priority} />
            </div>

            {contact.where_met && (
              <p className="mt-1.5 text-sm text-muted">Met at {contact.where_met}</p>
            )}
            {contact.notes && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">{contact.notes}</p>
            )}

            <div className="mt-2.5 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(contact)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(contact)}
                className="hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
