import { expect, test } from '@playwright/test';
import { fillRequiredGame, mockApplication, uploadView } from './helpers/mock-application';

test('rejecting Public confirmation does not start; approved Public remains Public', async ({
  browser,
}) => {
  const rejectedContext = await browser.newContext();
  const rejectedState = await mockApplication(rejectedContext);
  const rejectedPage = await rejectedContext.newPage();
  await rejectedPage.goto('/');
  await fillRequiredGame(rejectedPage);
  await rejectedPage.getByLabel('Requested Visibility').selectOption('Public');
  rejectedPage.once('dialog', (dialog) => dialog.dismiss());
  await rejectedPage.getByRole('button', { name: 'Start Game Upload' }).click();
  expect(rejectedState.starts).toHaveLength(0);
  await rejectedContext.close();

  const approvedContext = await browser.newContext();
  await mockApplication(approvedContext, { auditApproved: true, chunkOutcomes: ['success'] });
  const approvedPage = await approvedContext.newPage();
  await approvedPage.goto('/');
  await expect(approvedPage.getByText('Private-only mode.')).toBeHidden();
  await fillRequiredGame(approvedPage);
  await approvedPage.getByLabel('Requested Visibility').selectOption('Public');
  approvedPage.once('dialog', (dialog) => dialog.accept());
  await approvedPage.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(approvedPage.getByText(/Effective Visibility: Public/)).toBeVisible();
  await approvedContext.close();
});

test('busy state refreshes when the global upload slot becomes available', async ({ browser }) => {
  let status: object = { busy: true };
  const context = await browser.newContext();
  await mockApplication(context, { status: () => status });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Another Game Upload is active' })).toBeFocused();
  status = { busy: false };
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeFocused();
  await context.close();
});

test('refresh recovery treats an expired lease as released and retries other errors', async ({
  browser,
}) => {
  const expiredContext = await browser.newContext();
  await mockApplication(expiredContext, {
    status: { busy: true, upload: uploadView },
    cancelStatus: 410,
  });
  const expiredPage = await expiredContext.newPage();
  await expiredPage.goto('/');
  await expiredPage.getByRole('button', { name: 'Release and restart' }).click();
  await expect(
    expiredPage.getByRole('heading', { name: 'Publish one badminton Game' }),
  ).toBeVisible();
  await expect(expiredPage.getByText('Drag and drop one MP4 file here')).toBeVisible();
  await expiredContext.close();

  const failedContext = await browser.newContext();
  await mockApplication(failedContext, {
    status: { busy: true, upload: uploadView },
    cancelStatus: 500,
  });
  const failedPage = await failedContext.newPage();
  await failedPage.goto('/');
  await failedPage.getByRole('button', { name: 'Release and restart' }).click();
  await expect(failedPage.getByRole('alert')).toHaveText('Could not release the Game Upload.');
  await expect(failedPage.getByRole('heading', { name: 'Restart this Game Upload' })).toBeVisible();
  await failedContext.close();
});

test('cancels an active upload and clears all form state', async ({ browser }) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['pending'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByLabel(/Description/).fill('Temporary');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await page.getByRole('button', { name: 'Cancel upload' }).click();
  await expect(page.getByText('Drag and drop one MP4 file here')).toBeVisible();
  await expect(page.getByLabel('Match Date')).toHaveValue('');
  await expect(page.getByLabel(/Description/)).toHaveValue('');
  expect(state.cancelled).toBe(1);
  await context.close();
});

test('a heartbeat failure stops the upload and enters interruption recovery', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, {
    chunkOutcomes: ['pending'],
    heartbeatStatus: 502,
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('button', { name: 'Cancel upload' })).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('heading', { name: 'Restart this Game Upload' })).toBeVisible();
  expect(state.heartbeats).toBe(1);
  await page.clock.fastForward(30_000);
  expect(state.heartbeats).toBe(1);
  await context.close();
});

test('accepts Partial Success without another video upload', async ({ browser }) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { chunkOutcomes: ['partial'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByText('Partial Success', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept partial success' }).click();
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible();
  expect(state.acceptedPartialSuccess).toBe(1);
  expect(state.chunkOffsets).toEqual(['0']);
  await context.close();
});

test('shows success links and Done resets Match Date too', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context, { chunkOutcomes: ['success'] });
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('link', { name: 'Watch on YouTube ↗' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=video-1',
  );
  await expect(page.getByRole('link', { name: 'Edit in YouTube Studio ↗' })).toHaveAttribute(
    'href',
    'https://studio.youtube.com/video/video-1/edit',
  );
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByLabel('Match Date')).toHaveValue('');
  await context.close();
});

test('reports login failures and rate limiting', async ({ browser }) => {
  for (const [status, message] of [
    [401, 'The shared password is incorrect.'],
    [429, 'Too many failed sign-in attempts. Try again later.'],
  ] as const) {
    const context = await browser.newContext();
    await mockApplication(context, { authenticated: false, loginStatus: status });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByLabel('Shared password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await context.close();
  }
});

test('restores an authenticated session and logout returns focus to login', async ({ browser }) => {
  const context = await browser.newContext();
  const state = await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByLabel('Shared password')).toBeFocused();
  expect(state.logoutAttempts).toBe(1);
  await context.close();
});
