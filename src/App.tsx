import { type FormEvent, useEffect, useState } from 'react';
import type { UploadView } from '../shared/domain';
import { ApiError, api } from './api';
import { ScreenHeading } from './ScreenHeading';
import { UploadWorkspace, type WorkspaceScreen } from './UploadWorkspace';

export type Session = { auditApproved: boolean; publisherMode: 'fake' | 'live' };
type Screen = 'checking' | 'login' | 'form' | 'busy' | 'refresh-recovery' | WorkspaceScreen;
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.login(password);
      await onSuccess();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="centered-shell">
      <form className="card login-card" onSubmit={submit}>
        <p className="eyebrow">Trusted Uploaders</p>
        <h1>Badminton Uploader</h1>
        <p className="muted">Use the shared deployment password to continue.</p>
        <label>
          Shared password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

function Busy({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <main className="centered-shell">
      <section className="card status-card" aria-live="polite">
        <p className="status-icon" aria-hidden="true">
          ↥
        </p>
        <ScreenHeading>Another Game Upload is active</ScreenHeading>
        <p className="muted">
          There is one upload slot for everyone. Try again after the current upload finishes or its
          lease expires.
        </p>
        <button className="primary" onClick={() => void onRetry()}>
          Check again
        </button>
      </section>
    </main>
  );
}

function Interrupted({ upload, onReleased }: { upload: UploadView; onReleased: () => void }) {
  const [error, setError] = useState('');
  async function restart() {
    try {
      await api.cancel(upload.leaseId);
      onReleased();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 410) {
        onReleased();
        return;
      }
      setError(message(caught));
    }
  }
  return (
    <main className="centered-shell">
      <section className="card status-card">
        <ScreenHeading>Restart this Game Upload</ScreenHeading>
        <p className="muted">
          The video file is no longer available after an interruption, refresh, closed tab, or
          computer restart. Release this lease and begin again from byte zero.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" onClick={() => void restart()}>
          Release and restart
        </button>
      </section>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>('checking');
  const [activeUpload, setActiveUpload] = useState<UploadView | null>(null);
  async function load() {
    try {
      const current = await api.session();
      setSession(current);
      const status = await api.status();
      setActiveUpload(status.upload ?? null);
      setScreen(
        status.upload
          ? status.upload.state === 'partial_success'
            ? 'partial'
            : 'refresh-recovery'
          : status.busy
            ? 'busy'
            : 'form',
      );
    } catch {
      setSession(null);
      setScreen('login');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (screen === 'checking')
    return (
      <main className="centered-shell">
        <p role="status">Loading…</p>
      </main>
    );
  if (screen === 'login') return <Login onSuccess={load} />;
  if (!session) return null;
  async function logout() {
    await api.logout();
    setSession(null);
    setScreen('login');
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="shuttle" aria-hidden="true">
            ◒
          </span>{' '}
          Badminton Uploader
        </div>
        <button className="text-button" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      {screen === 'busy' && <Busy onRetry={load} />}
      {screen === 'refresh-recovery' && activeUpload && (
        <Interrupted
          upload={activeUpload}
          onReleased={() => {
            setActiveUpload(null);
            setScreen('form');
          }}
        />
      )}
      {(['form', 'uploading', 'interrupted', 'partial', 'success'] as Screen[]).includes(
        screen,
      ) && (
        <UploadWorkspace
          session={session}
          initialScreen={screen as WorkspaceScreen}
          initialUpload={activeUpload}
          onScreen={(next, upload) => {
            setScreen(next);
            setActiveUpload(upload ?? null);
          }}
        />
      )}
    </div>
  );
}
