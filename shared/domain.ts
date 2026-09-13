import { z } from 'zod';
import { caseFold } from 'unicode-case-folding';

export const CHUNK_SIZE = 64 * 1024 * 1024;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const LEASE_DURATION_MS = 5 * 60_000;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_TITLE_CHARACTERS = 100;
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export const matchTypeSchema = z.enum(['Singles Match', 'Doubles Match']);
export const visibilitySchema = z.enum(['Private', 'Unlisted', 'Public']);

export function normalizePlayerDisplayName(name: string): string {
  return name.trim().normalize('NFKC');
}

export function normalizePlayerName(name: string): string {
  return caseFold(normalizePlayerDisplayName(name));
}

export const playerDisplayNameSchema = z
  .string()
  .transform(normalizePlayerDisplayName)
  .pipe(
    z
      .string()
      .min(1, 'Enter a Player display name.')
      .max(200, 'Player display names must be at most 200 characters.'),
  );
export const playerSchema = z.object({
  id: z.string().min(1),
  displayName: playerDisplayNameSchema,
});
export const playerMutationSchema = z.object({ displayName: playerDisplayNameSchema }).strict();
export const playerMergeSchema = z.object({ targetPlayerId: z.string().min(1) }).strict();
export const playerListResponseSchema = z.object({ players: z.array(playerSchema) });

export const gameUploadMetadataSchema = z
  .object({
    fileName: z.string().trim().min(1, 'Select one MP4 file.'),
    fileSize: z
      .number()
      .int()
      .positive('The MP4 file must not be empty.')
      .max(MAX_VIDEO_BYTES, 'The MP4 file must be no larger than 2 GB.'),
    mimeType: z.literal('video/mp4', { error: 'Select an MP4 file.' }),
    matchType: matchTypeSchema,
    players: z.array(playerDisplayNameSchema).min(2).max(4),
    titleNames: z.array(playerDisplayNameSchema).min(2).max(4),
    matchDate: z.iso.date('Select a Match Date.'),
    gameNumber: z
      .number()
      .int()
      .positive('Game Number must be a positive whole number.')
      .optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title.')
      .max(MAX_TITLE_CHARACTERS, 'Titles must be at most 100 characters.'),
    description: z.string().max(5_000, 'Descriptions must be at most 5,000 characters.'),
    requestedVisibility: visibilitySchema,
  })
  .superRefine((value, context) => {
    const expected = value.matchType === 'Singles Match' ? 2 : 4;
    if (value.players.length !== expected || value.titleNames.length !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['players'],
        message: `${value.matchType} requires ${expected} Players.`,
      });
    }
    if (new Set(value.players.map(normalizePlayerName)).size !== value.players.length) {
      context.addIssue({
        code: 'custom',
        path: ['players'],
        message: 'A Player cannot occupy more than one position in a Game.',
      });
    }
  });

export const loginRequestSchema = z.object({ password: z.string().min(1).max(1_000) }).strict();
export const errorResponseSchema = z.object({
  error: z.string(),
  offset: z.number().int().nonnegative().optional(),
});
export const sessionResponseSchema = z.object({
  authenticated: z.literal(true),
  auditApproved: z.boolean(),
  publisherMode: z.enum(['fake', 'live']),
});

export type Player = z.infer<typeof playerSchema>;
export type GameUploadMetadata = z.infer<typeof gameUploadMetadataSchema>;
export type MatchType = z.infer<typeof matchTypeSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;

export function formatMatchDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function generateTitle(
  input: Pick<GameUploadMetadata, 'matchType' | 'titleNames' | 'matchDate' | 'gameNumber'>,
): string {
  const names =
    input.matchType === 'Singles Match'
      ? `${input.titleNames[0]} vs ${input.titleNames[1]}`
      : `${input.titleNames[0]}/${input.titleNames[1]} vs ${input.titleNames[2]}/${input.titleNames[3]}`;
  return `${names} | ${input.matchType}${input.gameNumber ? ` | Game ${input.gameNumber}` : ''} | ${formatMatchDate(input.matchDate)}`;
}

export type TitleState = { value: string; isCustom: boolean };
export function updateGeneratedTitle(state: TitleState, generatedTitle: string): TitleState {
  return state.isCustom ? state : { value: generatedTitle, isCustom: false };
}
export function editTitle(value: string): TitleState {
  return { value, isCustom: true };
}
export function regenerateTitle(generatedTitle: string): TitleState {
  return { value: generatedTitle, isCustom: false };
}
export function effectiveVisibility(requested: Visibility, auditApproved: boolean): Visibility {
  return auditApproved ? requested : 'Private';
}

export type UploadState = 'uploading' | 'partial_success';
export const uploadViewSchema = z.object({
  leaseId: z.string(),
  state: z.enum(['uploading', 'partial_success']),
  uploadedBytes: z.number().int().nonnegative(),
  uploadLength: z.number().int().positive(),
  requestedVisibility: visibilitySchema,
  effectiveVisibility: visibilitySchema,
  videoId: z.string().optional(),
  watchUrl: z.string().url().optional(),
  studioUrl: z.string().url().optional(),
});
export type UploadView = z.infer<typeof uploadViewSchema>;
