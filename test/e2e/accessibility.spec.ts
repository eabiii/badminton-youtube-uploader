import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { fillRequiredGame, mockApplication } from './helpers/mock-application';

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    results.violations
      .map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
      )
      .join('\n'),
  ).toEqual([]);
}

async function openState(
  browser: Browser,
  state: 'login' | 'form' | 'dialog' | 'busy' | 'uploading' | 'interrupted' | 'partial' | 'success',
) {
  const context = await browser.newContext();
  await mockApplication(
    context,
    state === 'login'
      ? { authenticated: false }
      : state === 'busy'
        ? { status: { busy: true } }
        : state === 'uploading'
          ? { chunkOutcomes: ['pending'] }
          : state === 'interrupted'
            ? { chunkOutcomes: ['failure'] }
            : state === 'partial'
              ? { chunkOutcomes: ['partial'] }
              : state === 'success'
                ? { chunkOutcomes: ['success'] }
                : {},
  );
  const page = await context.newPage();
  await page.goto('/');
  if (state === 'dialog') {
    await page.getByRole('button', { name: 'Manage Players' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  if (['uploading', 'interrupted', 'partial', 'success'].includes(state)) {
    await fillRequiredGame(page);
    await page.getByRole('button', { name: 'Start Game Upload' }).click();
  }
  if (state === 'uploading')
    await expect(page.getByRole('button', { name: 'Cancel upload' })).toBeVisible();
  if (state === 'interrupted')
    await expect(page.getByRole('heading', { name: 'Restart this Game Upload' })).toBeVisible();
  if (state === 'partial')
    await expect(page.getByText('Partial Success', { exact: true })).toBeVisible();
  if (state === 'success')
    await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  return { context, page };
}

for (const state of [
  'login',
  'form',
  'dialog',
  'busy',
  'uploading',
  'interrupted',
  'partial',
  'success',
] as const) {
  test(`${state} screen has no detectable accessibility violations`, async ({ browser }) => {
    const opened = await openState(browser, state);
    await expectAccessible(opened.page);
    await opened.context.close();
  });
}
