import { useEffect, useId, useRef, useState } from 'react';
import type { QueuingEntry } from '../shared/domain';

export function ManageQueuingDirectoryDialog({
  open,
  entries,
  onClose,
  onUpdate,
  onRemove,
}: {
  open: boolean;
  entries: QueuingEntry[];
  onClose: () => void;
  onUpdate: (entry: QueuingEntry, name: string, location: string) => Promise<void>;
  onRemove: (entry: QueuingEntry) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (open && !dialog.current?.open) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      dialog.current?.showModal();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
  }, [open]);

  async function action(key: string, work: () => Promise<void>) {
    setBusy(key);
    setError('');
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not update the Queuing Directory.',
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <dialog
      ref={dialog}
      className="manage-dialog"
      aria-labelledby="manage-queuing-title"
      aria-describedby="manage-queuing-description"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Queuing Directory</p>
          <h1 id="manage-queuing-title">Manage Queuing Directory</h1>
        </div>
        <button
          className="icon-button"
          aria-label="Close Manage Queuing Directory"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p id="manage-queuing-description" className="muted">
        Edit a Queuing Name and Queue Location or remove an entry. Active Game Upload snapshots are
        unchanged.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="directory-list">
        {entries.length ? (
          entries.map((entry) => (
            <QueuingRow
              key={entry.id}
              entry={entry}
              disabled={Boolean(busy)}
              onUpdate={(name, location) =>
                action(`update-${entry.id}`, () => onUpdate(entry, name, location))
              }
              onRemove={() => action(`remove-${entry.id}`, () => onRemove(entry))}
            />
          ))
        ) : (
          <p className="empty">No Queuing entries yet. Add one from the Queuing Session field.</p>
        )}
      </div>
      <div className="dialog-actions">
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}

function QueuingRow({
  entry,
  disabled,
  onUpdate,
  onRemove,
}: {
  entry: QueuingEntry;
  disabled: boolean;
  onUpdate: (name: string, location: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState(entry.name);
  const [location, setLocation] = useState(entry.location);
  useEffect(() => {
    setName(entry.name);
    setLocation(entry.location);
  }, [entry.name, entry.location]);
  const unchanged = name === entry.name && location === entry.location;

  return (
    <section className="directory-row queuing-directory-row" aria-labelledby={`${id}-entry`}>
      <span id={`${id}-entry`} className="directory-entry-name">
        {entry.name} — {entry.location}
      </span>
      <label>
        Queuing Name
        <input disabled={disabled} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Queue Location
        <input
          disabled={disabled}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        aria-label={`Save ${entry.name} at ${entry.location}`}
        disabled={disabled || unchanged}
        onClick={() => void onUpdate(name, location)}
      >
        Save
      </button>
      <button
        type="button"
        className="danger"
        aria-label={`Remove ${entry.name} at ${entry.location}`}
        disabled={disabled}
        onClick={() => {
          if (
            window.confirm(`Remove ${entry.name} at ${entry.location} from the Queuing Directory?`)
          )
            void onRemove();
        }}
      >
        Remove
      </button>
    </section>
  );
}
