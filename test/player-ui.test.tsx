// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCombobox } from '../src/PlayerCombobox';
import { uploadFormReducer, type UploadFormState } from '../src/upload-form-state';

const alice = { id: 'alice', displayName: 'Alice' };
const bob = { id: 'bob', displayName: 'Bob' };
const blank: UploadFormState = {
  file: null,
  matchType: 'Singles Match',
  players: [alice, bob, null, null],
  titleNames: ['Al', 'Bob', '', ''],
  matchDate: '2026-09-07',
  gameNumber: '2',
  description: 'Final',
  visibility: 'Public',
  title: { value: 'Custom finals title', isCustom: true },
  fileInputKey: 0,
};

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
    await user.click(screen.getByRole('button', { name: 'Add Player “Carla”' }));
    expect(add).toHaveBeenCalledWith('Carla');
    expect(select).toHaveBeenCalledWith({ id: 'cara', displayName: 'Carla' });
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
});
