import { type DragEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import {
  CHUNK_SIZE,
  HEARTBEAT_INTERVAL_MS,
  MAX_VIDEO_BYTES,
  gameUploadMetadataSchema,
  type Player,
  type QueuingEntry,
  type UploadView,
} from '../shared/domain';
import type { Session } from './App';
import { ApiError, api } from './api';
import { ManagePlayersDialog } from './ManagePlayersDialog';
import { ManageQueuingDirectoryDialog } from './ManageQueuingDirectoryDialog';
import { PlayerCombobox } from './PlayerCombobox';
import { QueuingCombobox } from './QueuingCombobox';
import { ScreenHeading } from './ScreenHeading';
import { useUploadFormState } from './upload-form-state';

export type WorkspaceScreen = 'form' | 'uploading' | 'partial' | 'success' | 'interrupted';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

export function UploadWorkspace({
  session,
  initialScreen,
  initialUpload,
  onScreen,
}: {
  session: Session;
  initialScreen: WorkspaceScreen;
  initialUpload: UploadView | null;
  onScreen: (screen: WorkspaceScreen, upload?: UploadView | null) => void;
}) {
  const { state, dispatch, count, generatedTitle } = useUploadFormState();
  const [players, setPlayers] = useState<Player[]>([]);
  const [queuingEntries, setQueuingEntries] = useState<QueuingEntry[]>([]);
  const [managePlayersOpen, setManagePlayersOpen] = useState(false);
  const [manageQueuingOpen, setManageQueuingOpen] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(initialUpload?.uploadedBytes ?? 0);
  const [upload, setUpload] = useState<UploadView | null>(initialUpload);
  const [screen, setScreen] = useState(initialScreen);
  const [draggingVideo, setDraggingVideo] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    void refreshDirectories();
  }, []);
  async function refreshDirectories() {
    try {
      const [playerResult, queuingResult] = await Promise.all([
        api.players(),
        api.queuingEntries(),
      ]);
      setPlayers(playerResult.players);
      setQueuingEntries(queuingResult.queuingEntries);
    } catch (caught) {
      setError(message(caught));
    }
  }
  function transition(next: WorkspaceScreen, nextUpload?: UploadView | null) {
    setScreen(next);
    if (nextUpload !== undefined) setUpload(nextUpload);
    onScreen(next, nextUpload);
  }
  async function addPlayer(displayName: string) {
    const created = await api.addPlayer(displayName);
    setPlayers((current) =>
      [...current, created].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'und', { sensitivity: 'base' }),
      ),
    );
    return created;
  }
  async function renamePlayer(previous: Player, displayName: string) {
    const updated = await api.renamePlayer(previous.id, displayName);
    setPlayers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    dispatch({ type: 'rename', player: updated });
  }
  async function mergePlayer(source: Player, targetId: string) {
    const target = await api.mergePlayer(source.id, targetId);
    setPlayers((current) => current.filter((entry) => entry.id !== source.id));
    dispatch({ type: 'merge', sourceId: source.id, target });
  }
  async function removePlayer(player: Player) {
    await api.removePlayer(player.id);
    setPlayers((current) => current.filter((entry) => entry.id !== player.id));
    dispatch({ type: 'remove', id: player.id });
  }
  const sortQueuingEntries = (entries: QueuingEntry[]) =>
    [...entries].sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'und', { sensitivity: 'base' }) ||
        a.location.localeCompare(b.location, 'und', { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    );
  async function addQueuingEntry(name: string, location: string) {
    const created = await api.addQueuingEntry(name, location);
    setQueuingEntries((current) => sortQueuingEntries([...current, created]));
    return created;
  }
  async function updateQueuingEntry(previous: QueuingEntry, name: string, location: string) {
    const updated = await api.updateQueuingEntry(previous.id, name, location);
    setQueuingEntries((current) =>
      sortQueuingEntries(current.map((entry) => (entry.id === updated.id ? updated : entry))),
    );
  }
  async function removeQueuingEntry(entry: QueuingEntry) {
    await api.removeQueuingEntry(entry.id);
    setQueuingEntries((current) => current.filter((candidate) => candidate.id !== entry.id));
  }

  function selectVideo(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1) {
      setError('Select one MP4 file.');
      return;
    }
    setError('');
    dispatch({ type: 'field', field: 'file', value: files[0] ?? null });
  }
  function dragVideo(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!uploading) setDraggingVideo(true);
  }
  function leaveVideo(event: DragEvent<HTMLLabelElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingVideo(false);
  }
  function dropVideo(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingVideo(false);
    if (!uploading) selectVideo(event.dataTransfer.files);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!state.file) {
      setError('Select one MP4 file.');
      return;
    }
    const common = {
      fileName: state.file.name,
      fileSize: state.file.size,
      mimeType: state.file.type,
      matchDate: state.matchDate,
      gameNumber: state.gameNumber ? Number(state.gameNumber) : undefined,
      title: state.title.value,
      description: state.description,
      requestedVisibility: state.visibility,
    };
    const parsed = gameUploadMetadataSchema.safeParse(
      state.titleFormat === 'player_match'
        ? {
            ...common,
            titleFormat: 'player_match',
            matchType: state.matchType,
            players: state.players.slice(0, count).map((entry) => entry?.displayName ?? ''),
            titleNames: state.titleNames.slice(0, count),
          }
        : {
            ...common,
            titleFormat: 'queuing_session',
            queuingName: state.queuingEntry?.name ?? '',
            queueLocation: state.queuingEntry?.location ?? '',
          },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the Game Upload.');
      return;
    }
    if (
      state.visibility === 'Public' &&
      !window.confirm('Publish this Game publicly on YouTube now?')
    )
      return;
    let current: UploadView | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      current = await api.start(parsed.data);
      setUpload(current);
      transition('uploading', current);
      heartbeat = setInterval(() => {
        if (current)
          void api.heartbeat(current.leaseId).catch((caught: unknown) => {
            if (controller.signal.aborted || !current) return;
            setError(message(caught));
            transition('interrupted', current);
            controller.abort();
          });
      }, HEARTBEAT_INTERVAL_MS);
      let offset = current.uploadedBytes;
      while (offset < state.file.size) {
        const chunk = state.file.slice(offset, Math.min(offset + CHUNK_SIZE, state.file.size));
        try {
          const result = await api.chunk(current.leaseId, offset, chunk, controller.signal);
          offset = result.nextOffset;
          setProgress(offset);
          if (result.complete && result.upload) {
            current = result.upload;
            setUpload(current);
            transition(current.state === 'partial_success' ? 'partial' : 'success', current);
          }
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 409 && caught.offset !== undefined) {
            offset = caught.offset;
            setProgress(offset);
            continue;
          }
          throw caught;
        }
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(message(caught));
        if (current) transition('interrupted', current);
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (uploadAbort.current === controller) uploadAbort.current = null;
    }
  }
  function reset(retainDate: boolean) {
    dispatch({ type: 'reset', retainDate });
    setProgress(0);
    setUpload(null);
    setError('');
    transition('form', null);
  }
  async function cancel() {
    if (!upload) return;
    uploadAbort.current?.abort();
    try {
      await api.cancel(upload.leaseId);
      reset(false);
    } catch (caught) {
      setError(message(caught));
    }
  }
  async function releaseAndRestart() {
    if (!upload) return;
    setError('');
    try {
      await api.cancel(upload.leaseId);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 410)) {
        setError(message(caught));
        return;
      }
    }
    setProgress(0);
    setUpload(null);
    transition('form', null);
  }
  async function retryPlaylist() {
    if (!upload) return;
    try {
      const completed = await api.retryPlaylist(upload.leaseId);
      setUpload(completed);
      transition('success', completed);
    } catch (caught) {
      setError(message(caught));
    }
  }
  async function acceptPartial() {
    if (!upload) return;
    try {
      await api.acceptPartialSuccess(upload.leaseId);
      reset(false);
    } catch (caught) {
      setError(message(caught));
    }
  }

  if (screen === 'success' && upload)
    return <Result upload={upload} onDone={() => reset(false)} onAnother={() => reset(true)} />;
  if (screen === 'partial' && upload)
    return (
      <main className="content">
        <section className="card status-card" aria-live="polite">
          <p className="eyebrow warning">Partial Success</p>
          <ScreenHeading>The Game is on YouTube, but not in the Destination Playlist</ScreenHeading>
          <p className="muted">
            Retry only the playlist step. The video will not be uploaded again.
          </p>
          <Links upload={upload} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button className="primary" onClick={() => void retryPlaylist()}>
              Retry playlist addition
            </button>
            <button className="secondary" onClick={() => void acceptPartial()}>
              Accept partial success
            </button>
          </div>
        </section>
      </main>
    );
  if (screen === 'interrupted' && upload)
    return (
      <main className="content">
        <section className="card status-card" aria-describedby="interruption-description">
          <p className="eyebrow warning">Upload interrupted</p>
          <ScreenHeading>Restart this Game Upload</ScreenHeading>
          <p id="interruption-description" className="muted">
            Your selected MP4 and form details are still available in this tab. Release this lease,
            then submit again to begin from byte zero.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" onClick={() => void releaseAndRestart()}>
            Release and restart
          </button>
        </section>
      </main>
    );

  const uploading = screen === 'uploading';
  return (
    <main className="content">
      <div className="heading-row">
        <div>
          <p className="eyebrow">New Game Upload</p>
          <ScreenHeading>Publish one badminton Game</ScreenHeading>
        </div>
        <div className="heading-actions">
          {state.titleFormat === 'player_match' ? (
            <button
              className="secondary"
              disabled={uploading}
              onClick={() => setManagePlayersOpen(true)}
            >
              Manage Players
            </button>
          ) : (
            <button
              className="secondary"
              disabled={uploading}
              onClick={() => setManageQueuingOpen(true)}
            >
              Manage Queuing Directory
            </button>
          )}
          <p className="mode-badge">
            {session.publisherMode === 'fake' ? 'Local fake publisher' : 'YouTube'}
          </p>
        </div>
      </div>
      {!session.auditApproved && (
        <div className="notice" role="note">
          <strong>Private-only mode.</strong> You may record a requested Visibility, but until the
          YouTube API compliance audit is approved this Game will be uploaded as Private.
        </div>
      )}
      <form className="card upload-form" onSubmit={submit} noValidate>
        <section>
          <h2>Video</h2>
          <label
            className={`file-drop${draggingVideo ? ' drag-active' : ''}${uploading ? ' disabled' : ''}`}
            onDragEnter={dragVideo}
            onDragOver={dragVideo}
            onDragLeave={leaveVideo}
            onDrop={dropVideo}
          >
            <input
              key={state.fileInputKey}
              type="file"
              accept="video/mp4"
              required
              disabled={uploading}
              aria-label="Choose one MP4 file (up to 2 GB)"
              onChange={(event) => selectVideo(event.target.files)}
            />
            {state.file ? (
              <span className="file-name">{state.file.name}</span>
            ) : (
              <>
                <span className="file-drop-title">Drag and drop one MP4 file here</span>
                <span className="file-drop-hint">
                  or choose one from your computer (up to 2 GB)
                </span>
              </>
            )}
          </label>
          {state.file && (
            <small className={state.file.size > MAX_VIDEO_BYTES ? 'field-error' : ''}>
              {(state.file.size / 1024 / 1024).toFixed(1)} MB
            </small>
          )}
        </section>
        <section>
          <fieldset className="title-format">
            <legend>Title format</legend>
            <div className="radio-cards">
              <label className="radio-card">
                <input
                  type="radio"
                  name="title-format"
                  value="player_match"
                  checked={state.titleFormat === 'player_match'}
                  disabled={uploading}
                  onChange={() =>
                    dispatch({ type: 'field', field: 'titleFormat', value: 'player_match' })
                  }
                />
                <span>
                  <strong>Player Match</strong>
                  <small>Build the title from the selected Players and match classification.</small>
                </span>
              </label>
              <label className="radio-card">
                <input
                  type="radio"
                  name="title-format"
                  value="queuing_session"
                  checked={state.titleFormat === 'queuing_session'}
                  disabled={uploading}
                  onChange={() =>
                    dispatch({ type: 'field', field: 'titleFormat', value: 'queuing_session' })
                  }
                />
                <span>
                  <strong>Queuing Session</strong>
                  <small>Build the title from a saved Queuing Directory entry.</small>
                </span>
              </label>
            </div>
          </fieldset>
        </section>
        <section>
          <h2>Game details</h2>
          <div className="field-grid common-game-fields">
            <label>
              Match Date
              <input
                type="date"
                value={state.matchDate}
                disabled={uploading}
                required
                onChange={(event) =>
                  dispatch({ type: 'field', field: 'matchDate', value: event.target.value })
                }
              />
            </label>
            <label>
              Game Number <span className="optional">Optional</span>
              <input
                type="number"
                min="1"
                step="1"
                value={state.gameNumber}
                disabled={uploading}
                onChange={(event) =>
                  dispatch({ type: 'field', field: 'gameNumber', value: event.target.value })
                }
              />
            </label>
          </div>
          {state.titleFormat === 'player_match' ? (
            <>
              <label className="match-type-field">
                Match Type
                <select
                  value={state.matchType}
                  disabled={uploading}
                  onChange={(event) =>
                    dispatch({
                      type: 'field',
                      field: 'matchType',
                      value: event.target.value as typeof state.matchType,
                    })
                  }
                >
                  <option>Singles Match</option>
                  <option>Doubles Match</option>
                </select>
              </label>
              <div className="players">
                {Array.from({ length: count }, (_, index) => (
                  <div className="player-row" key={index}>
                    <PlayerCombobox
                      label={`Player ${index + 1}`}
                      players={players}
                      selected={state.players[index]}
                      disabled={uploading}
                      onAdd={addPlayer}
                      onSelect={(player) => dispatch({ type: 'player', index, player })}
                    />
                    <label>
                      Title Name Override <span className="optional">This upload only</span>
                      <input
                        value={state.titleNames[index]}
                        disabled={uploading || !state.players[index]}
                        onChange={(event) =>
                          dispatch({ type: 'titleName', index, value: event.target.value })
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="queuing-field">
              <QueuingCombobox
                entries={queuingEntries}
                selected={state.queuingEntry}
                disabled={uploading}
                onAdd={addQueuingEntry}
                onSelect={(entry) => dispatch({ type: 'queuingEntry', entry })}
              />
            </div>
          )}
        </section>
        <section>
          <h2>YouTube details</h2>
          <label>
            Title{' '}
            <span className={state.title.value.length > 100 ? 'count over' : 'count'}>
              {state.title.value.length}/100
            </span>
            <input
              value={state.title.value}
              maxLength={100}
              disabled={uploading}
              required
              onChange={(event) => dispatch({ type: 'editTitle', value: event.target.value })}
            />
          </label>
          {state.title.isCustom && (
            <button
              type="button"
              className="text-button inline"
              disabled={uploading || !generatedTitle}
              onClick={() => dispatch({ type: 'regenerate', value: generatedTitle })}
            >
              Regenerate title
            </button>
          )}
          <label>
            Description <span className="optional">Optional</span>
            <textarea
              value={state.description}
              maxLength={5000}
              disabled={uploading}
              onChange={(event) =>
                dispatch({ type: 'field', field: 'description', value: event.target.value })
              }
            />
          </label>
          <label>
            Requested Visibility
            <select
              value={state.visibility}
              disabled={uploading}
              onChange={(event) =>
                dispatch({
                  type: 'field',
                  field: 'visibility',
                  value: event.target.value as typeof state.visibility,
                })
              }
            >
              <option>Private</option>
              <option>Unlisted</option>
              <option>Public</option>
            </select>
          </label>
          {!session.auditApproved && state.visibility !== 'Private' && (
            <p className="visibility-note" role="status">
              Effective Visibility for this upload: <strong>Private</strong>
            </p>
          )}
          <p className="fixed-details">
            Audience: Not made for kids · Category: Sports · Destination Playlist: configured
            playlist
          </p>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {uploading && upload ? (
          <div className="progress-block" aria-live="polite">
            <progress value={progress} max={upload.uploadLength} aria-label="Upload progress" />
            <span>{Math.floor((progress / upload.uploadLength) * 100)}% uploaded</span>
            <button type="button" className="danger" onClick={() => void cancel()}>
              Cancel upload
            </button>
          </div>
        ) : (
          <button className="primary wide">Start Game Upload</button>
        )}
      </form>
      <ManagePlayersDialog
        open={managePlayersOpen}
        players={players}
        onClose={() => setManagePlayersOpen(false)}
        onRename={renamePlayer}
        onMerge={mergePlayer}
        onRemove={removePlayer}
      />
      <ManageQueuingDirectoryDialog
        open={manageQueuingOpen}
        entries={queuingEntries}
        onClose={() => setManageQueuingOpen(false)}
        onUpdate={updateQueuingEntry}
        onRemove={removeQueuingEntry}
      />
    </main>
  );
}

function Links({ upload }: { upload: UploadView }) {
  return (
    <div className="links">
      {upload.watchUrl && (
        <a href={upload.watchUrl} target="_blank" rel="noreferrer">
          Watch on YouTube ↗
        </a>
      )}
      {upload.studioUrl && (
        <a href={upload.studioUrl} target="_blank" rel="noreferrer">
          Edit in YouTube Studio ↗
        </a>
      )}
    </div>
  );
}
function Result({
  upload,
  onDone,
  onAnother,
}: {
  upload: UploadView;
  onDone: () => void;
  onAnother: () => void;
}) {
  return (
    <main className="content">
      <section className="card status-card" aria-live="polite">
        <p className="success-mark" aria-hidden="true">
          ✓
        </p>
        <ScreenHeading>Game uploaded</ScreenHeading>
        <p className="muted">
          YouTube accepted the video and it was added to the Destination Playlist. Processing and
          copyright checks continue in YouTube Studio.
        </p>
        <p>
          <strong>Effective Visibility:</strong> {upload.effectiveVisibility}
        </p>
        <Links upload={upload} />
        <div className="button-row">
          <button className="primary" onClick={onAnother}>
            Upload another
          </button>
          <button className="secondary" onClick={onDone}>
            Done
          </button>
        </div>
      </section>
    </main>
  );
}
