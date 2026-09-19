// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadView } from '../shared/domain';
import { UploadWorkspace } from '../src/UploadWorkspace';
import { ApiError, api } from '../src/api';

const players = [
  { id: 'a', displayName: 'Alice' },
  { id: 'b', displayName: 'Bob' },
];
const uploading: UploadView = {
  leaseId: 'lease-1',
  state: 'uploading',
  uploadedBytes: 0,
  uploadLength: 3,
  requestedVisibility: 'Unlisted',
  effectiveVisibility: 'Private',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UploadWorkspace recovery states', () => {
  it('accepts Partial Success and discards its transient state', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'players').mockResolvedValue({ players });
    vi.spyOn(api, 'acceptPartialSuccess').mockResolvedValue(undefined);
    const onScreen = vi.fn();
    render(
      <UploadWorkspace
        session={{ auditApproved: false, publisherMode: 'fake' }}
        initialScreen="partial"
        initialUpload={{
          ...uploading,
          state: 'partial_success',
          videoId: 'video-1',
          watchUrl: 'https://www.youtube.com/watch?v=video-1',
          studioUrl: 'https://studio.youtube.com/video/video-1/edit',
        }}
        onScreen={onScreen}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Accept partial success' }));
    expect(api.acceptPartialSuccess).toHaveBeenCalledWith('lease-1');
    expect(onScreen).toHaveBeenLastCalledWith('form', null);
    expect(screen.getByRole('heading', { name: 'Publish one badminton Game' })).toHaveFocus();
  });

  it('retains the in-memory form through interruption and treats release 410 as success', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'players').mockResolvedValue({ players });
    vi.spyOn(api, 'start').mockResolvedValue(uploading);
    vi.spyOn(api, 'chunk').mockRejectedValue(new ApiError('Network unavailable.', 502));
    vi.spyOn(api, 'cancel').mockRejectedValue(
      new ApiError('The upload lease expired. Restart from byte zero.', 410),
    );
    render(
      <UploadWorkspace
        session={{ auditApproved: false, publisherMode: 'fake' }}
        initialScreen="form"
        initialUpload={null}
        onScreen={vi.fn()}
      />,
    );
    await waitFor(() => expect(api.players).toHaveBeenCalled());
    await user.upload(
      screen.getByLabelText(/Choose one MP4/),
      new File(['abc'], 'game.mp4', { type: 'video/mp4' }),
    );
    await user.selectOptions(screen.getByLabelText('Match Type'), 'Singles Match');
    await user.type(screen.getByLabelText('Match Date'), '2026-09-07');
    for (const [label, name] of [
      ['Player 1', 'Alice'],
      ['Player 2', 'Bob'],
    ]) {
      await user.click(screen.getByRole('combobox', { name: label }));
      await user.click(screen.getByRole('option', { name, exact: true }));
    }
    await user.type(screen.getByLabelText(/Description/), 'Retained description');
    await user.click(screen.getByRole('button', { name: 'Start Game Upload' }));
    expect(await screen.findByRole('heading', { name: 'Restart this Game Upload' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Release and restart' }));
    expect(screen.getByText('game.mp4')).toBeVisible();
    expect(screen.getByLabelText(/Description/)).toHaveValue('Retained description');
    expect(api.cancel).toHaveBeenCalledWith('lease-1');
  });
});
