import { expect, test } from '@playwright/test';
import { fillRequiredGame, mockApplication } from './helpers/mock-application';

test('selects the Game video by drag and drop', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  const transfer = await page.evaluateHandle(`(() => {
    const data = new DataTransfer(); data.items.add(new File(['abc'], 'dropped-game.mp4', { type: 'video/mp4' })); return data;
  })()`);
  const dropTarget = page.locator('.file-drop');
  await dropTarget.dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(dropTarget).toHaveClass(/drag-active/);
  await dropTarget.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(dropTarget).not.toHaveClass(/drag-active/);
  await expect(page.getByText('dropped-game.mp4')).toBeVisible();
  await expect(page.getByText('0.0 MB')).toBeVisible();
  await context.close();
});

test('defaults new Game Uploads to Doubles Match', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByLabel('Match Type')).toHaveValue('Doubles Match');
  await expect(page.getByRole('combobox', { name: 'Player 4' })).toBeVisible();
  await context.close();
});

test('separate Uploader contexts see the single global upload slot', async ({ browser }) => {
  let busy = false;
  const first = await browser.newContext();
  const second = await browser.newContext();
  await mockApplication(first);
  await mockApplication(second, { status: () => ({ busy }) });
  const page = await first.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  busy = true;
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('button', { name: 'Cancel upload' })).toBeVisible();
  const otherPage = await second.newPage();
  await otherPage.goto('/');
  await expect(
    otherPage.getByRole('heading', { name: 'Another Game Upload is active' }),
  ).toBeVisible();
  await first.close();
  await second.close();
});

test('confirms Public, reports effective Private, and Upload another retains only Match Date', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context, { chunkOutcomes: ['success'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  const title = page.getByRole('textbox', { name: /^Title \d/ });
  await title.fill('Custom finals title');
  await page.getByLabel('Game Number').fill('3');
  await page.getByLabel(/Description/).fill('Reset me');
  await page.getByLabel('Match Date').fill('2026-09-08');
  await expect(title).toHaveValue('Custom finals title');
  await page.getByRole('button', { name: 'Regenerate title' }).click();
  await expect(title).toHaveValue(/September 8, 2026/);
  await page.getByLabel('Requested Visibility').selectOption('Public');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  await expect(page.getByText(/Effective Visibility: Private/)).toBeVisible();
  await expect(page.getByRole('link', { name: /YouTube Studio/ })).toHaveAttribute(
    'href',
    /video-1/,
  );
  await page.getByRole('button', { name: 'Upload another' }).click();
  expect(await page.getByLabel('Match Date').inputValue()).toBe('2026-09-08');
  expect(await page.getByLabel('Match Type').inputValue()).toBe('Doubles Match');
  expect(await page.getByLabel('Requested Visibility').inputValue()).toBe('Unlisted');
  expect(await page.getByRole('combobox', { name: 'Player 1' }).inputValue()).toBe('');
  expect(await page.getByLabel('Game Number').inputValue()).toBe('');
  expect(await page.getByLabel(/Description/).inputValue()).toBe('');
  expect(await page.locator('input[maxlength="100"]').inputValue()).toBe('');
  await expect(page.getByText('Drag and drop one MP4 file here')).toBeVisible();
  await context.close();
});

test('recovers Partial Success with a playlist-only retry', async ({ browser }) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['partial'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByText('Partial Success', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry playlist addition' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  expect(state.chunkOffsets).toEqual(['0']);
  await context.close();
});

test('an in-flight interruption retains the form and restarts the file from byte zero', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['failure', 'success'] });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByLabel('Game Number').fill('2');
  await page.getByLabel(/Description/).fill('Retained description');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('heading', { name: 'Restart this Game Upload' })).toBeVisible();
  await page.clock.fastForward(31_000);
  expect(state.heartbeats).toBe(0);
  await page.getByRole('button', { name: 'Release and restart' }).click();
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible();
  await expect(page.getByText('game.mp4')).toBeVisible();
  await expect(page.getByLabel('Game Number')).toHaveValue('2');
  await expect(page.getByLabel(/Description/)).toHaveValue('Retained description');
  await expect
    .poll(() =>
      page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    )
    .toEqual({ local: 0, session: 0 });
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  expect(state.starts).toHaveLength(2);
  expect(state.chunkOffsets).toEqual(['0', '0']);
  await context.close();
});

test('shared-password login reaches the form and cancellation releases the current upload', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { authenticated: false });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Shared password').fill('shared password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await page.getByRole('button', { name: 'Cancel upload' }).click();
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible();
  expect(state.cancelled).toBe(1);
  await context.close();
});
