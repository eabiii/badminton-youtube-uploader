import { useEffect, useMemo, useReducer } from 'react';
import {
  editTitle,
  generateTitle,
  regenerateTitle,
  updateGeneratedTitle,
  type MatchType,
  type Player,
  type QueuingEntry,
  type TitleFormat,
  type TitleState,
  type Visibility,
} from '../shared/domain';

export type UploadFormState = {
  file: File | null;
  titleFormat: TitleFormat;
  matchType: MatchType;
  players: (Player | null)[];
  titleNames: string[];
  queuingEntry: QueuingEntry | null;
  matchDate: string;
  gameNumber: string;
  description: string;
  visibility: Visibility;
  title: TitleState;
  fileInputKey: number;
};
export type UploadFormAction =
  | {
      type: 'field';
      field:
        | 'file'
        | 'titleFormat'
        | 'matchType'
        | 'matchDate'
        | 'gameNumber'
        | 'description'
        | 'visibility';
      value: File | TitleFormat | MatchType | Visibility | string | null;
    }
  | { type: 'player'; index: number; player: Player | null }
  | { type: 'queuingEntry'; entry: QueuingEntry | null }
  | { type: 'titleName'; index: number; value: string }
  | { type: 'generated'; value: string }
  | { type: 'editTitle'; value: string }
  | { type: 'regenerate'; value: string }
  | { type: 'merge'; sourceId: string; target: Player }
  | { type: 'remove'; id: string }
  | { type: 'rename'; player: Player }
  | { type: 'reset'; retainDate: boolean };

const initial = (matchDate = ''): UploadFormState => ({
  file: null,
  titleFormat: 'player_match',
  matchType: 'Doubles Match',
  players: [null, null, null, null],
  titleNames: ['', '', '', ''],
  queuingEntry: null,
  matchDate,
  gameNumber: '',
  description: '',
  visibility: 'Unlisted',
  title: { value: '', isCustom: false },
  fileInputKey: 0,
});

export function uploadFormReducer(
  state: UploadFormState,
  action: UploadFormAction,
): UploadFormState {
  if (action.type === 'field') return { ...state, [action.field]: action.value } as UploadFormState;
  if (action.type === 'player') {
    const players = [...state.players];
    const titleNames = [...state.titleNames];
    players[action.index] = action.player;
    titleNames[action.index] = action.player?.displayName ?? '';
    return { ...state, players, titleNames };
  }
  if (action.type === 'queuingEntry') return { ...state, queuingEntry: action.entry };
  if (action.type === 'titleName') {
    const titleNames = [...state.titleNames];
    titleNames[action.index] = action.value;
    return { ...state, titleNames };
  }
  if (action.type === 'generated')
    return { ...state, title: updateGeneratedTitle(state.title, action.value) };
  if (action.type === 'editTitle') return { ...state, title: editTitle(action.value) };
  if (action.type === 'regenerate') return { ...state, title: regenerateTitle(action.value) };
  if (action.type === 'merge') {
    const players = state.players.map((entry) =>
      entry?.id === action.sourceId ? action.target : entry,
    );
    const titleNames = state.titleNames.map((name, index) =>
      state.players[index]?.id === action.sourceId ? action.target.displayName : name,
    );
    return { ...state, players, titleNames };
  }
  if (action.type === 'remove') {
    const players = state.players.map((entry) => (entry?.id === action.id ? null : entry));
    const titleNames = state.titleNames.map((name, index) =>
      state.players[index]?.id === action.id ? '' : name,
    );
    return { ...state, players, titleNames };
  }
  if (action.type === 'rename') {
    const players = state.players.map((entry) =>
      entry?.id === action.player.id ? action.player : entry,
    );
    const titleNames = state.titleNames.map((name, index) =>
      state.players[index]?.id === action.player.id ? action.player.displayName : name,
    );
    return { ...state, players, titleNames };
  }
  const reset = initial(action.retainDate ? state.matchDate : '');
  if (action.retainDate && state.titleFormat === 'queuing_session') {
    reset.titleFormat = 'queuing_session';
    reset.queuingEntry = state.queuingEntry;
  }
  reset.fileInputKey = state.fileInputKey + 1;
  return reset;
}

export function useUploadFormState() {
  const [state, dispatch] = useReducer(uploadFormReducer, undefined, () => initial());
  const count = state.matchType === 'Singles Match' ? 2 : 4;
  const generatedTitle = useMemo(() => {
    if (!state.matchDate) return '';
    const gameNumber = state.gameNumber ? Number(state.gameNumber) : undefined;
    if (state.titleFormat === 'queuing_session') {
      if (!state.queuingEntry) return '';
      return generateTitle({
        titleFormat: 'queuing_session',
        queuingName: state.queuingEntry.name,
        queueLocation: state.queuingEntry.location,
        matchDate: state.matchDate,
        gameNumber,
      });
    }
    if (state.titleNames.slice(0, count).some((name) => !name.trim())) return '';
    return generateTitle({
      titleFormat: 'player_match',
      matchType: state.matchType,
      titleNames: state.titleNames.slice(0, count),
      matchDate: state.matchDate,
      gameNumber,
    });
  }, [
    state.titleFormat,
    state.matchType,
    state.titleNames,
    state.queuingEntry,
    state.matchDate,
    state.gameNumber,
    count,
  ]);
  useEffect(() => {
    dispatch({ type: 'generated', value: generatedTitle });
  }, [generatedTitle]);
  return { state, dispatch, count, generatedTitle };
}
