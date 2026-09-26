import { expect, test } from '@playwright/test';
import {
  fillRequiredGame,
  mockApplication,
  selectPlayer,
  selectQueuingEntry,
} from './helpers/mock-application';

test('Title format radio cards switch required fields without losing either draft', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');

  const playerMatch = page.getByRole('radio', { name: /Player Match/ });
  const queuingSession = page.getByRole('radio', { name: /Queuing Session/ });
  await expect(page.getByRole('group', { name: 'Title format' })).toBeVisible();
  await expect(playerMatch).toBeChecked();
  await expect(queuingSession).not.toBeChecked();
  await page.getByLabel('Match Type').selectOption('Singles Match');
  await selectPlayer(page, 'Player 1', 'Alice');
  await selectPlayer(page, 'Player 2', 'Bob');

  await playerMatch.focus();
  await page.keyboard.press('ArrowRight');
  await expect(queuingSession).toBeChecked();
  await expect(page.getByLabel('Match Type')).toBeHidden();
  await selectQueuingEntry(page, 'GOODSHOTS! — Gameville Central Park');

  await queuingSession.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('combobox', { name: 'Player 1' })).toHaveValue('Alice');
  await expect(page.getByRole('combobox', { name: 'Player 2' })).toHaveValue('Bob');
  await playerMatch.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('combobox', { name: 'Queuing Session' })).toHaveValue(
    'GOODSHOTS! — Gameville Central Park',
  );
  await context.close();
});

test('adds, searches, edits, and removes Queuing Directory entries while preserving a snapshot', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('radio', { name: /Queuing Session/ }).check();

  const combo = page.getByRole('combobox', { name: 'Queuing Session' });
  await combo.fill('Riverside');
  await expect(page.getByRole('option', { name: 'Friday Club — Riverside Hall' })).toBeVisible();
  await page.getByRole('option', { name: 'Add new queuing…' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Add new queuing' });
  await addDialog.getByLabel('Queuing Name').fill('Saturday Crew');
  await addDialog.getByLabel('Queue Location').fill('East Sports Hall');
  await addDialog.getByRole('button', { name: 'Add queuing' }).click();
  await expect(combo).toHaveValue('Saturday Crew — East Sports Hall');

  await page.getByRole('button', { name: 'Manage Queuing Directory' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Queuing Directory' });
  const row = dialog.getByRole('region', { name: 'Saturday Crew — East Sports Hall' });
  await row.getByLabel('Queuing Name').fill('Weekend Crew');
  await row.getByLabel('Queue Location').fill('West Sports Hall');
  await row.getByRole('button', { name: 'Save Saturday Crew at East Sports Hall' }).click();
  await expect(combo).toHaveValue('Saturday Crew — East Sports Hall');
  page.once('dialog', (confirmation) => confirmation.accept());
  await dialog.getByRole('button', { name: 'Remove Weekend Crew at West Sports Hall' }).click();
  await expect(combo).toHaveValue('Saturday Crew — East Sports Hall');
  await context.close();
});

test('generates Queuing titles, sends the Queuing snapshot, and retains it for Upload another', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['success'] });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('radio', { name: /Queuing Session/ }).check();
  await selectQueuingEntry(page, 'GOODSHOTS! — Gameville Central Park');
  await page.getByLabel('Match Date').fill('2026-09-15');
  const title = page.locator('input[maxlength="100"]');
  await expect(title).toHaveValue('GOODSHOTS! | Gameville Central Park | September 15, 2026');
  await page.getByLabel('Game Number').fill('1');
  await expect(title).toHaveValue(
    'GOODSHOTS! | Gameville Central Park | Game 1 | September 15, 2026',
  );
  await page
    .getByLabel(/Choose one MP4/)
    .setInputFiles({ name: 'game.mp4', mimeType: 'video/mp4', buffer: Buffer.from('abc') });
  await page.getByLabel(/Description/).fill('Queuing games');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  expect(state.starts[0]).toMatchObject({
    titleFormat: 'queuing_session',
    queuingName: 'GOODSHOTS!',
    queueLocation: 'Gameville Central Park',
    gameNumber: 1,
  });
  expect(state.starts[0]).not.toHaveProperty('players');

  await page.getByRole('button', { name: 'Upload another' }).click();
  await expect(page.getByRole('radio', { name: /Queuing Session/ })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Queuing Session' })).toHaveValue(
    'GOODSHOTS! — Gameville Central Park',
  );
  await expect(page.getByLabel('Match Date')).toHaveValue('2026-09-15');
  await expect(page.getByLabel('Game Number')).toHaveValue('');
  await expect(page.getByLabel(/Description/)).toHaveValue('');
  await expect(page.getByLabel('Requested Visibility')).toHaveValue('Unlisted');
  await expect(page.getByText('Drag and drop one MP4 file here')).toBeVisible();
  await context.close();
});

test('preserves a Custom Title across modes and regenerates from the selected mode', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  const title = page.locator('input[maxlength="100"]');
  await title.fill('Custom club night');
  await page.getByRole('radio', { name: /Queuing Session/ }).check();
  await selectQueuingEntry(page, 'GOODSHOTS! — Gameville Central Park');
  await expect(title).toHaveValue('Custom club night');
  await page.getByRole('button', { name: 'Regenerate title' }).click();
  await expect(title).toHaveValue('GOODSHOTS! | Gameville Central Park | September 7, 2026');
  await context.close();
});

test('existing Player Match uploads send only Player Match fields', async ({ browser }) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['success'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  expect(state.starts[0]).toMatchObject({
    titleFormat: 'player_match',
    matchType: 'Singles Match',
    players: ['Alice', 'Bob'],
  });
  expect(state.starts[0]).not.toHaveProperty('queuingName');
  await context.close();
});
