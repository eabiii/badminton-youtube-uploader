import { useEffect, useMemo, useReducer } from 'react';
import { editTitle, generateTitle, regenerateTitle, updateGeneratedTitle, type MatchType, type Player, type TitleState, type Visibility } from '../shared/domain';

export type UploadFormState = { file: File | null; matchType: MatchType; players: (Player | null)[]; titleNames: string[]; matchDate: string;
  gameNumber: string; description: string; visibility: Visibility; title: TitleState; fileInputKey: number };
export type UploadFormAction =
  | { type: 'field'; field: 'file' | 'matchType' | 'matchDate' | 'gameNumber' | 'description' | 'visibility'; value: File | MatchType | Visibility | string | null }
  | { type: 'player'; index: number; player: Player | null } | { type: 'titleName'; index: number; value: string }
  | { type: 'generated'; value: string } | { type: 'editTitle'; value: string } | { type: 'regenerate'; value: string }
  | { type: 'merge'; sourceId: string; target: Player }
  | { type: 'remove'; id: string } | { type: 'rename'; player: Player } | { type: 'reset'; retainDate: boolean };

const initial = (matchDate = ''): UploadFormState => ({ file: null, matchType: 'Doubles Match', players: [null, null, null, null],
  titleNames: ['', '', '', ''], matchDate, gameNumber: '', description: '', visibility: 'Unlisted',
  title: { value: '', isCustom: false }, fileInputKey: 0 });

export function uploadFormReducer(state: UploadFormState, action: UploadFormAction): UploadFormState {
  if (action.type === 'field') return { ...state, [action.field]: action.value } as UploadFormState;
  if (action.type === 'player') { const players = [...state.players]; const titleNames = [...state.titleNames]; players[action.index] = action.player; titleNames[action.index] = action.player?.displayName ?? ''; return { ...state, players, titleNames }; }
  if (action.type === 'titleName') { const titleNames = [...state.titleNames]; titleNames[action.index] = action.value; return { ...state, titleNames }; }
  if (action.type === 'generated') return { ...state, title: updateGeneratedTitle(state.title, action.value) };
  if (action.type === 'editTitle') return { ...state, title: editTitle(action.value) };
  if (action.type === 'regenerate') return { ...state, title: regenerateTitle(action.value) };
  if (action.type === 'merge') { const players = state.players.map((entry) => entry?.id === action.sourceId ? action.target : entry); const titleNames = state.titleNames.map((name, index) => state.players[index]?.id === action.sourceId ? action.target.displayName : name); return { ...state, players, titleNames }; }
  if (action.type === 'remove') { const players = state.players.map((entry) => entry?.id === action.id ? null : entry); const titleNames = state.titleNames.map((name, index) => state.players[index]?.id === action.id ? '' : name); return { ...state, players, titleNames }; }
  if (action.type === 'rename') { const players = state.players.map((entry) => entry?.id === action.player.id ? action.player : entry); const titleNames = state.titleNames.map((name, index) => state.players[index]?.id === action.player.id ? action.player.displayName : name); return { ...state, players, titleNames }; }
  const reset = initial(action.retainDate ? state.matchDate : ''); reset.fileInputKey = state.fileInputKey + 1; return reset;
}

export function useUploadFormState() {
  const [state, dispatch] = useReducer(uploadFormReducer, undefined, () => initial());
  const count = state.matchType === 'Singles Match' ? 2 : 4;
  const generatedTitle = useMemo(() => {
    if (!state.matchDate || state.titleNames.slice(0, count).some((name) => !name.trim())) return '';
    return generateTitle({ matchType: state.matchType, titleNames: state.titleNames.slice(0, count), matchDate: state.matchDate,
      gameNumber: state.gameNumber ? Number(state.gameNumber) : undefined });
  }, [state.matchType, state.titleNames, state.matchDate, state.gameNumber, count]);
  useEffect(() => { dispatch({ type: 'generated', value: generatedTitle }); }, [generatedTitle]);
  return { state, dispatch, count, generatedTitle };
}
