// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerCombobox } from '../src/PlayerCombobox';
import { ManagePlayersDialog } from '../src/ManagePlayersDialog';
import { ManageQueuingDirectoryDialog } from '../src/ManageQueuingDirectoryDialog';
import { uploadFormReducer, type UploadFormState } from '../src/upload-form-state';
import { QueuingCombobox } from '../src/QueuingCombobox';

const alice = { id: 'alice', displayName: 'Alice' };
const bob = { id: 'bob', displayName: 'Bob' };
const blank: UploadFormState = {
  file: null,
  titleFormat: 'player_match',
  matchType: 'Singles Match',
  players: [alice, bob, null, null],
  titleNames: ['Al', 'Bob', '', ''],
  queuingEntry: null,
  matchDate: '2026-09-07',
  gameNumber: '2',
  description: 'Final',
  visibility: 'Public',
  title: { value: 'Custom finals title', isCustom: true },
  fileInputKey: 0,
};

afterEach(cleanup);

describe('Player upload interactions', () => {
  it('supports keyboard search and explicit unknown-Player addition', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const add = vi.fn(async (name: string) => ({ id: 'cara', displayName: name.trim() }));
    render(
      <PlayerCombobox
        label="Player 1"
        players={[alice, bob]}
        selected={null}
        disabled={false}
        onSelect={select}
        onAdd={add}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Player 1' });
    await user.click(input);
    await user.keyboard('Carla');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('option', { name: 'Add Player “Carla”' }));
    expect(add).toHaveBeenCalledWith('Carla');
    expect(select).toHaveBeenCalledWith({ id: 'cara', displayName: 'Carla' });
  });

  it('selects and dismisses Player options with the keyboard', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <PlayerCombobox
        label="Player 1"
        players={[alice, bob]}
        selected={null}
        disabled={false}
        onSelect={select}
        onAdd={vi.fn()}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Player 1' });
    await user.click(input);
    await user.keyboard('Ali{ArrowDown}{Enter}');
    expect(select).toHaveBeenLastCalledWith(alice);
    expect(input).toHaveValue('Alice');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
  });

  it('operates the Player Directory by keyboard and restores focus on close', async () => {
    const user = userEvent.setup();
    const rename = vi.fn(async () => undefined);
    const close = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const opener = document.createElement('button');
    opener.textContent = 'Manage Players';
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <ManagePlayersDialog
        open
        players={[alice, bob]}
        onClose={close}
        onRename={rename}
        onMerge={vi.fn(async () => undefined)}
        onRemove={vi.fn(async () => undefined)}
      />,
    );
    const name = screen.getByLabelText('Alice display name');
    await user.clear(name);
    await user.keyboard('Alicia');
    await user.click(screen.getByRole('button', { name: 'Rename Alice' }));
    expect(rename).toHaveBeenCalledWith(alice, 'Alicia');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    rerender(
      <ManagePlayersDialog
        open={false}
        players={[alice, bob]}
        onClose={close}
        onRename={rename}
        onMerge={vi.fn(async () => undefined)}
        onRemove={vi.fn(async () => undefined)}
      />,
    );
    expect(opener).toHaveFocus();
    confirm.mockRestore();
    opener.remove();
  });

  it('resets only the changed position override and moves merged selections', () => {
    const changed = uploadFormReducer(blank, {
      type: 'player',
      index: 0,
      player: { id: 'cara', displayName: 'Carla' },
    });
    expect(changed.titleNames).toEqual(['Carla', 'Bob', '', '']);
    const merged = uploadFormReducer(blank, { type: 'merge', sourceId: 'alice', target: bob });
    expect(merged.players.slice(0, 2)).toEqual([bob, bob]);
    expect(merged.titleNames.slice(0, 2)).toEqual(['Bob', 'Bob']);
  });

  it('Upload another retains only Match Date', () => {
    const reset = uploadFormReducer(blank, { type: 'reset', retainDate: true });
    expect(reset.matchDate).toBe('2026-09-07');
    expect(reset.matchType).toBe('Doubles Match');
    expect(reset.players).toEqual([null, null, null, null]);
    expect(reset.gameNumber).toBe('');
    expect(reset.description).toBe('');
    expect(reset.visibility).toBe('Unlisted');
    expect(reset.title).toEqual({ value: '', isCustom: false });
  });

  it('preserves unfinished fields while switching modes and retains Queuing selection on Upload another', () => {
    const entry = { id: 'queue-1', name: 'GOODSHOTS!', location: 'Central Park' };
    const queuing = uploadFormReducer(
      uploadFormReducer(blank, {
        type: 'field',
        field: 'titleFormat',
        value: 'queuing_session',
      }),
      { type: 'queuingEntry', entry },
    );
    expect(queuing.players.slice(0, 2)).toEqual([alice, bob]);
    expect(queuing.titleNames.slice(0, 2)).toEqual(['Al', 'Bob']);
    const switchedBack = uploadFormReducer(queuing, {
      type: 'field',
      field: 'titleFormat',
      value: 'player_match',
    });
    expect(switchedBack.queuingEntry).toEqual(entry);

    const reset = uploadFormReducer(queuing, { type: 'reset', retainDate: true });
    expect(reset.titleFormat).toBe('queuing_session');
    expect(reset.queuingEntry).toEqual(entry);
    expect(reset.matchDate).toBe('2026-09-07');
    expect(reset.file).toBeNull();
    expect(reset.gameNumber).toBe('');
    expect(reset.description).toBe('');
    expect(reset.visibility).toBe('Unlisted');
    expect(reset.title).toEqual({ value: '', isCustom: false });
  });

  it('searches Queuing entries by location and adds a new entry from a dialog', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const add = vi.fn(async (name: string, location: string) => ({
      id: 'queue-2',
      name: name.trim(),
      location: location.trim(),
    }));
    render(
      <QueuingCombobox
        entries={[{ id: 'queue-1', name: 'GOODSHOTS!', location: 'Central Park' }]}
        selected={null}
        disabled={false}
        onSelect={select}
        onAdd={add}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Queuing Session' });
    await user.type(input, 'Central');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(select).toHaveBeenLastCalledWith({
      id: 'queue-1',
      name: 'GOODSHOTS!',
      location: 'Central Park',
    });

    await user.clear(input);
    await user.click(screen.getByRole('option', { name: 'Add new queuing…' }));
    await user.type(screen.getByLabelText('Queuing Name'), 'Friday Games');
    await user.type(screen.getByLabelText('Queue Location'), 'Sports Centre');
    await user.click(screen.getByRole('button', { name: 'Add queuing' }));
    expect(add).toHaveBeenCalledWith('Friday Games', 'Sports Centre');
    expect(select).toHaveBeenLastCalledWith({
      id: 'queue-2',
      name: 'Friday Games',
      location: 'Sports Centre',
    });
  });

  it('edits and removes Queuing Directory entries without mutating the selected snapshot', async () => {
    const user = userEvent.setup();
    const entry = { id: 'queue-1', name: 'GOODSHOTS!', location: 'Central Park' };
    const selectedSnapshot = { ...entry };
    const update = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ManageQueuingDirectoryDialog
        open
        entries={[entry]}
        onClose={vi.fn()}
        onUpdate={update}
        onRemove={remove}
      />,
    );
    await user.clear(screen.getByLabelText('Queuing Name'));
    await user.type(screen.getByLabelText('Queuing Name'), 'Friday Games');
    await user.clear(screen.getByLabelText('Queue Location'));
    await user.type(screen.getByLabelText('Queue Location'), 'Sports Centre');
    await user.click(screen.getByRole('button', { name: 'Save GOODSHOTS! at Central Park' }));
    expect(update).toHaveBeenCalledWith(entry, 'Friday Games', 'Sports Centre');
    await user.click(screen.getByRole('button', { name: 'Remove GOODSHOTS! at Central Park' }));
    expect(remove).toHaveBeenCalledWith(entry);
    expect(selectedSnapshot).toEqual({
      id: 'queue-1',
      name: 'GOODSHOTS!',
      location: 'Central Park',
    });
  });
});
