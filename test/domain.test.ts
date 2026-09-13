import { describe, expect, it } from 'vitest';
import {
  editTitle,
  effectiveVisibility,
  formatMatchDate,
  gameUploadMetadataSchema,
  generateTitle,
  normalizePlayerDisplayName,
  normalizePlayerName,
  regenerateTitle,
  updateGeneratedTitle,
} from '../shared/domain';

const base = {
  fileName: 'game.mp4',
  fileSize: 100,
  mimeType: 'video/mp4' as const,
  matchType: 'Singles Match' as const,
  players: ['Alice', 'Bob'],
  titleNames: ['Alice', 'Bob'],
  matchDate: '2026-09-07',
  title: 'Alice vs Bob | Singles Match | September 7, 2026',
  description: '',
  requestedVisibility: 'Unlisted' as const,
};

describe('Game Upload domain rules', () => {
  it('generates the specified English title', () => {
    expect(generateTitle({ ...base, gameNumber: 2 })).toBe(
      'Alice vs Bob | Singles Match | Game 2 | September 7, 2026',
    );
  });

  it('normalizes Player uniqueness with trim, NFKC, and case folding', () => {
    expect(normalizePlayerDisplayName('  Ａlice ')).toBe('Alice');
    expect(normalizePlayerName('  ＡLICE ')).toBe('alice');
    const parsed = gameUploadMetadataSchema.safeParse({ ...base, players: ['Alice', ' ＡLICE '] });
    expect(parsed.success).toBe(false);
  });

  it('formats Singles, Doubles, optional Game Number, and Match Dates', () => {
    expect(formatMatchDate('2026-01-02')).toBe('January 2, 2026');
    expect(
      generateTitle({
        matchType: 'Doubles Match',
        titleNames: ['A', 'B', 'C', 'D'],
        matchDate: '2026-09-07',
      }),
    ).toBe('A/B vs C/D | Doubles Match | September 7, 2026');
  });

  it('keeps a Custom Title sticky until explicit regeneration', () => {
    const custom = editTitle('Finals night');
    expect(updateGeneratedTitle(custom, 'Alice vs Bob')).toEqual(custom);
    expect(regenerateTitle('Alice vs Bob')).toEqual({ value: 'Alice vs Bob', isCustom: false });
  });

  it('uses Title Name Overrides only in generated titles', () => {
    expect(generateTitle({ ...base, titleNames: ['A', 'B'] })).toBe(
      'A vs B | Singles Match | September 7, 2026',
    );
    expect(base.players).toEqual(['Alice', 'Bob']);
  });

  it('truthfully enforces Private visibility until audit approval', () => {
    expect(effectiveVisibility('Public', false)).toBe('Private');
    expect(effectiveVisibility('Unlisted', true)).toBe('Unlisted');
  });

  it('requires four unique Players for Doubles', () => {
    const parsed = gameUploadMetadataSchema.safeParse({
      ...base,
      matchType: 'Doubles Match',
      players: ['A', 'B', 'C'],
      titleNames: ['A', 'B', 'C'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty and overlong titles', () => {
    expect(gameUploadMetadataSchema.safeParse({ ...base, title: ' ' }).success).toBe(false);
    expect(gameUploadMetadataSchema.safeParse({ ...base, title: 'x'.repeat(101) }).success).toBe(
      false,
    );
  });

  it('rejects invalid files and Game Numbers', () => {
    expect(
      gameUploadMetadataSchema.safeParse({ ...base, mimeType: 'video/quicktime' }).success,
    ).toBe(false);
    expect(
      gameUploadMetadataSchema.safeParse({ ...base, fileSize: 2 * 1024 * 1024 * 1024 + 1 }).success,
    ).toBe(false);
    expect(gameUploadMetadataSchema.safeParse({ ...base, gameNumber: 0 }).success).toBe(false);
  });
});
