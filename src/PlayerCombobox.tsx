import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState('');
  const previousSelection = useRef(selected);
  useEffect(() => {
    setQuery((current) => {
      if (selected) return selected.displayName;
      return normalizePlayerName(current) ===
        normalizePlayerName(previousSelection.current?.displayName ?? '')
        ? ''
        : current;
    });
    previousSelection.current = selected;
  }, [selected]);
  const matches = useMemo(() => {
    const normalized = normalizePlayerName(query);
    return players.filter((entry) => normalizePlayerName(entry.displayName).includes(normalized));
  }, [players, query]);
  const exact = players.some(
    (entry) => normalizePlayerName(entry.displayName) === normalizePlayerName(query),
  );
  const canAdd = Boolean(query.trim()) && !exact;
  const optionCount = matches.length + (canAdd ? 1 : 0);
  function choose(player: Player) {
    setQuery(player.displayName);
    setOpen(false);
    setActiveIndex(-1);
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
  function moveActive(direction: 1 | -1) {
    setOpen(true);
    setActiveIndex((current) => {
      if (!optionCount) return -1;
      if (current < 0) return direction === 1 ? 0 : optionCount - 1;
      return (current + direction + optionCount) % optionCount;
    });
  }
  const activeOptionId =
    activeIndex < 0
      ? undefined
      : activeIndex < matches.length
        ? `${id}-option-${activeIndex}`
        : `${id}-add`;
  return (
    <div className="combobox-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-autocomplete="list"
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        disabled={disabled}
        required
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (
            normalizePlayerName(event.target.value) !==
            normalizePlayerName(selected?.displayName ?? '')
          )
            onSelect(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActive(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActive(-1);
          }
          if (event.key === 'Enter' && open && activeIndex >= 0) {
            event.preventDefault();
            const player = matches[activeIndex];
            if (player) choose(player);
            else void add();
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
              tabIndex={-1}
              aria-selected={selected?.id === entry.id}
              key={entry.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(entry)}
            >
              {entry.displayName}
            </button>
          ))}
          {canAdd && (
            <button
              id={`${id}-add`}
              type="button"
              role="option"
              aria-selected={activeIndex === matches.length}
              tabIndex={-1}
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
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
