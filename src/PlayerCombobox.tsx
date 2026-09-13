import { useEffect, useId, useMemo, useState } from 'react';
import { normalizePlayerName, type Player } from '../shared/domain';

export function PlayerCombobox({
  label,
  players,
  selected,
  disabled,
  onSelect,
  onAdd,
}: {
  label: string;
  players: Player[];
  selected: Player | null;
  disabled: boolean;
  onSelect: (player: Player | null) => void;
  onAdd: (displayName: string) => Promise<Player>;
}) {
  const id = useId();
  const [query, setQuery] = useState(selected?.displayName ?? '');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setQuery(selected?.displayName ?? '');
  }, [selected]);
  const matches = useMemo(() => {
    const normalized = normalizePlayerName(query);
    return players.filter((entry) => normalizePlayerName(entry.displayName).includes(normalized));
  }, [players, query]);
  const exact = players.some(
    (entry) => normalizePlayerName(entry.displayName) === normalizePlayerName(query),
  );
  function choose(player: Player) {
    setQuery(player.displayName);
    setOpen(false);
    setError('');
    onSelect(player);
  }
  async function add() {
    try {
      choose(await onAdd(query));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add Player.');
    }
  }
  return (
    <div className="combobox-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        required
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (
            normalizePlayerName(event.target.value) !==
            normalizePlayerName(selected?.displayName ?? '')
          )
            onSelect(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            document.getElementById(`${id}-option-0`)?.focus();
          }
        }}
      />
      {open && (
        <div id={`${id}-list`} className="combobox-list" role="listbox">
          {matches.map((entry, index) => (
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selected?.id === entry.id}
              key={entry.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(entry)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown')
                  document.getElementById(`${id}-option-${index + 1}`)?.focus();
                if (event.key === 'ArrowUp')
                  (index
                    ? document.getElementById(`${id}-option-${index - 1}`)
                    : document.getElementById(id)
                  )?.focus();
              }}
            >
              {entry.displayName}
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              className="add-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void add()}
            >
              Add Player “{query.trim()}”
            </button>
          )}
          {!matches.length && (!query.trim() || exact) && <p>No Players found.</p>}
        </div>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
