import { useEffect, useId, useRef, useState } from 'react';
import type { Player } from '../shared/domain';

export function ManagePlayersDialog({
  open,
  players,
  onClose,
  onRename,
  onMerge,
  onRemove,
}: {
  open: boolean;
  players: Player[];
  onClose: () => void;
  onRename: (player: Player, displayName: string) => Promise<void>;
  onMerge: (source: Player, targetId: string) => Promise<void>;
  onRemove: (player: Player) => Promise<void>;
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
      setError(caught instanceof Error ? caught.message : 'Could not update the Player Directory.');
    } finally {
      setBusy('');
    }
  }
  return (
    <dialog
      ref={dialog}
      className="manage-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="manage-title"
      aria-describedby="manage-description"
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Player Directory</p>
          <h1 id="manage-title">Manage Players</h1>
        </div>
        <button className="icon-button" aria-label="Close Manage Players" onClick={onClose}>
          ×
        </button>
      </div>
      <p id="manage-description" className="muted">
        Rename a Player, merge duplicate entries, or remove an entry. Active Game Upload snapshots
        are unchanged.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="directory-list">
        {players.length ? (
          players.map((entry) => (
            <PlayerRow
              key={entry.id}
              player={entry}
              players={players}
              busy={busy}
              onRename={(name) => action(`rename-${entry.id}`, () => onRename(entry, name))}
              onMerge={(target) => action(`merge-${entry.id}`, () => onMerge(entry, target))}
              onRemove={() => action(`remove-${entry.id}`, () => onRemove(entry))}
            />
          ))
        ) : (
          <p className="empty">No Players yet. Add one from a Player field.</p>
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

function PlayerRow({
  player,
  players,
  busy,
  onRename,
  onMerge,
  onRemove,
}: {
  player: Player;
  players: Player[];
  busy: string;
  onRename: (name: string) => Promise<void>;
  onMerge: (target: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState(player.displayName);
  const [target, setTarget] = useState('');
  const disabled = Boolean(busy);
  useEffect(() => setName(player.displayName), [player.displayName]);
  return (
    <section className="directory-row" aria-labelledby={`${id}-name`}>
      <label htmlFor={`${id}-display-name`}>
        <span id={`${id}-name`}>{player.displayName}</span> display name
        <input
          id={`${id}-display-name`}
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        aria-label={`Rename ${player.displayName}`}
        disabled={disabled || name === player.displayName}
        onClick={() => void onRename(name)}
      >
        Rename
      </button>
      <label htmlFor={`${id}-merge-target`}>
        Merge {player.displayName} into
        <select
          id={`${id}-merge-target`}
          value={target}
          disabled={disabled}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Choose target…</option>
          {players
            .filter((entry) => entry.id !== player.id)
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
              </option>
            ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary"
        aria-label={`Merge ${player.displayName}`}
        disabled={disabled || !target}
        onClick={() => {
          const targetPlayer = players.find((entry) => entry.id === target);
          if (
            targetPlayer &&
            window.confirm(
              `Merge ${player.displayName} into ${targetPlayer.displayName}? This cannot be undone.`,
            )
          )
            void onMerge(target);
        }}
      >
        Merge
      </button>
      <button
        type="button"
        className="danger"
        aria-label={`Remove ${player.displayName}`}
        disabled={disabled}
        onClick={() => {
          if (window.confirm(`Remove ${player.displayName} from the Player Directory?`))
            void onRemove();
        }}
      >
        Remove
      </button>
    </section>
  );
}
