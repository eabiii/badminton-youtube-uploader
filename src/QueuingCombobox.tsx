import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeQueuingValue, type QueuingEntry } from '../shared/domain';

const labelFor = (entry: QueuingEntry) => `${entry.name} — ${entry.location}`;

export function QueuingCombobox({
  entries,
  selected,
  disabled,
  onSelect,
  onAdd,
}: {
  entries: QueuingEntry[];
  selected: QueuingEntry | null;
  disabled: boolean;
  onSelect: (entry: QueuingEntry | null) => void;
  onAdd: (name: string, location: string) => Promise<QueuingEntry>;
}) {
  const id = useId();
  const [query, setQuery] = useState(selected ? labelFor(selected) : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [addOpen, setAddOpen] = useState(false);
  const previousSelection = useRef(selected);

  useEffect(() => {
    setQuery((current) => {
      if (selected) return labelFor(selected);
      return previousSelection.current && current === labelFor(previousSelection.current)
        ? ''
        : current;
    });
    previousSelection.current = selected;
  }, [selected]);

  const matches = useMemo(() => {
    const normalized = normalizeQueuingValue(query);
    return entries.filter((entry) => normalizeQueuingValue(labelFor(entry)).includes(normalized));
  }, [entries, query]);
  const optionCount = matches.length + 1;

  function choose(entry: QueuingEntry) {
    setQuery(labelFor(entry));
    setOpen(false);
    setActiveIndex(-1);
    onSelect(entry);
  }

  function moveActive(direction: 1 | -1) {
    setOpen(true);
    setActiveIndex((current) => {
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
      <label htmlFor={id}>Queuing Session</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? activeOptionId : undefined}
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
          setActiveIndex(-1);
          if (!selected || event.target.value !== labelFor(selected)) onSelect(null);
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
            const entry = matches[activeIndex];
            if (entry) choose(entry);
            else {
              setOpen(false);
              setAddOpen(true);
            }
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
              {labelFor(entry)}
            </button>
          ))}
          <button
            id={`${id}-add`}
            type="button"
            role="option"
            aria-selected={activeIndex === matches.length}
            tabIndex={-1}
            className="add-option"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
          >
            Add new queuing…
          </button>
        </div>
      )}
      <AddQueuingEntryDialog
        open={addOpen}
        initialName={query.includes(' — ') ? '' : query.trim()}
        onClose={() => setAddOpen(false)}
        onAdd={async (name, location) => {
          const entry = await onAdd(name, location);
          choose(entry);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function AddQueuingEntryDialog({
  open,
  initialName,
  onClose,
  onAdd,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onAdd: (name: string, location: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !dialog.current?.open) {
      setName(initialName);
      setLocation('');
      setError('');
      dialog.current?.showModal();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open, initialName]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await onAdd(name, location);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the Queuing entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="manage-dialog small-dialog"
      aria-labelledby={`${dialogId}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <h1 id={`${dialogId}-title`}>Add new queuing</h1>
        <label>
          Queuing Name
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Queue Location
          <input required value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions button-row">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            Add queuing
          </button>
        </div>
      </div>
    </dialog>
  );
}

const dialogId = 'add-queuing-entry';
