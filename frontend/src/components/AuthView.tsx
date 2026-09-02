import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorBanner, Spinner } from '@/components/ui/feedback';
import { neon } from '@/neon';

type Mode = 'signin' | 'signup';

/**
 * Sign-in and sign-up. Credentials go straight from this form to Neon's
 * Managed Better Auth service -- they never touch our backend, which only ever
 * sees the resulting JWT.
 */
export function AuthView() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Email and password are both required.');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);

    try {
      const result =
        mode === 'signin'
          ? await neon.auth.signIn.email({ email: email.trim(), password })
          : await neon.auth.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
            });

      if (result.error) {
        setError(result.error.message ?? 'Could not sign you in.');
        return;
      }

      // If the project requires email confirmation, sign-up succeeds without
      // establishing a session. Say so rather than appearing to hang.
      if (mode === 'signup' && !result.data?.user) {
        setNotice('Check your email to confirm your account, then sign in.');
      }
    } catch {
      setError('Could not reach the authentication service.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Networking Tracker
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Keep track of the people you want to stay connected with at Berkeley.
        </p>
      </div>

      <div className="rounded-card border bg-surface p-5 shadow-sm">
        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1"
        >
          {(['signin', 'signup'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className={`h-9 rounded-md text-sm font-medium transition-colors ${
                mode === value
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {value === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {mode === 'signup' && (
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@berkeley.edu"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          {notice && (
            <p
              role="status"
              className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-ink"
            >
              {notice}
            </p>
          )}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy && <Spinner />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>
    </main>
  );
}
