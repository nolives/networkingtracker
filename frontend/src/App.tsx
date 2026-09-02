import { LogOut, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthView } from '@/components/AuthView';
import { ContactForm } from '@/components/ContactForm';
import {
  ContactList,
  sortAndFilter,
  type Sort,
  type SortKey,
} from '@/components/ContactList';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/field';
import {
  EmptyState,
  ErrorBanner,
  Spinner,
  TableSkeleton,
  Toast,
} from '@/components/ui/feedback';
import * as api from '@/api';
import { neon } from '@/neon';
import { PRIORITIES, type Contact, type ContactDraft } from '@/types';

/**
 * Mobile sort options. The desktop table sorts via its clickable column
 * headers, but those headers are hidden below `md`, so without this control
 * sorting would be unreachable on a phone. Each option encodes both the key
 * and the direction, which keeps the mobile control a single tap.
 */
const SORT_OPTIONS: { value: string; label: string; sort: Sort }[] = [
  { value: 'created_at:desc', label: 'Newest first', sort: { key: 'created_at', direction: 'desc' } },
  { value: 'created_at:asc', label: 'Oldest first', sort: { key: 'created_at', direction: 'asc' } },
  { value: 'name:asc', label: 'Name A–Z', sort: { key: 'name', direction: 'asc' } },
  { value: 'name:desc', label: 'Name Z–A', sort: { key: 'name', direction: 'desc' } },
  { value: 'company:asc', label: 'Company A–Z', sort: { key: 'company', direction: 'asc' } },
  { value: 'priority:asc', label: 'Priority (high first)', sort: { key: 'priority', direction: 'asc' } },
];

export default function App() {
  const { data: session, isPending } = neon.auth.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-6 w-6 text-muted" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (!session?.user) return <AuthView />;

  return <ContactsScreen userEmail={session.user.email ?? ''} />;
}

function ContactsScreen({ userEmail }: { userEmail: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [sort, setSort] = useState<Sort>({ key: 'created_at', direction: 'desc' });
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setContacts(await api.listContacts());
    } catch {
      setLoadError('Could not load your contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const visible = useMemo(
    () => sortAndFilter(contacts, { sort, priority, search }),
    [contacts, sort, priority, search]
  );

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'created_at' ? 'desc' : 'asc' }
    );
  }

  /** Errors propagate so ContactForm can render per-field messages. */
  async function handleSubmit(draft: ContactDraft) {
    if (editing) {
      const updated = await api.updateContact(editing.id, draft);
      setContacts((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setToast('Contact updated.');
    } else {
      const created = await api.createContact(draft);
      setContacts((prev) => [created, ...prev]);
      setToast('Contact added.');
    }
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteContact(deleting.id);
      setContacts((prev) => prev.filter((c) => c.id !== deleting.id));
      setToast('Contact deleted.');
      setDeleting(null);
    } catch {
      setLoadError('Could not delete that contact.');
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtersActive = priority !== 'all' || search.trim() !== '';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              Networking Tracker
            </h1>
            <p className="truncate text-xs text-muted">{userEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => neon.auth.signOut()}
            className="shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, notes…"
              aria-label="Search contacts"
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            {/* Mobile only: the desktop table sorts via its column headers. */}
            <Select
              value={`${sort.key}:${sort.direction}`}
              onChange={(e) => {
                const option = SORT_OPTIONS.find((o) => o.value === e.target.value);
                if (option) setSort(option.sort);
              }}
              aria-label="Sort contacts"
              className="flex-1 md:hidden"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Filter by priority"
              className="flex-1 sm:w-40 sm:flex-none"
            >
              <option value="all">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>

            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add contact</span>
            </Button>
          </div>
        </div>

        {loadError && (
          <div className="mb-4">
            <ErrorBanner message={loadError} onRetry={() => void load()} />
          </div>
        )}

        <section className="overflow-hidden rounded-card border bg-surface">
          {loading ? (
            <TableSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState
              title="No contacts yet"
              message="Add the first person you want to stay connected with."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add contact
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title="No matches"
              message="No contacts match your current filters."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setPriority('all');
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ContactList
              contacts={visible}
              sort={sort}
              onSort={toggleSort}
              onEdit={(contact) => {
                setEditing(contact);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          )}
        </section>

        {!loading && contacts.length > 0 && (
          <p aria-live="polite" className="mt-3 text-xs text-muted">
            Showing {visible.length} of {contacts.length} contact
            {contacts.length === 1 ? '' : 's'}
            {filtersActive && ' (filtered)'}
          </p>
        )}
      </main>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent
          title={editing ? 'Edit contact' : 'Add contact'}
          description={
            editing
              ? 'Update the details for this contact.'
              : 'Only a name is required.'
          }
        >
          <ContactForm contact={editing} onSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent
          title="Delete contact"
          description={`"${deleting?.name}" will be permanently removed.`}
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy && <Spinner />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast message={toast} />}
    </div>
  );
}
