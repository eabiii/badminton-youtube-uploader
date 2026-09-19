import { expect, test } from '@playwright/test';
import { mockApplication, selectPlayer } from './helpers/mock-application';

test('autocompletes and adds an unknown Player with the keyboard', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  const player = page.getByRole('combobox', { name: 'Player 1' });
  await player.focus();
  await player.fill('Ali');
  await player.press('ArrowDown');
  await player.press('Enter');
  await expect(player).toHaveValue('Alice');
  await player.fill('Evelyn');
  await player.press('ArrowDown');
  await player.press('Enter');
  await expect(player).toHaveValue('Evelyn');
  await context.close();
});

test('renames, merges, and removes Players with confirmations', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await selectPlayer(page, 'Player 1', 'Alice');
  const opener = page.getByRole('button', { name: 'Manage Players' });
  await opener.click();
  await page.getByLabel('Alice display name').fill('Alicia');
  await page.getByRole('button', { name: 'Rename Alice' }).click();
  await expect(page.getByLabel('Alicia display name')).toBeVisible();

  await page.getByLabel('Merge Bob into').selectOption({ label: 'Alicia' });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Merge Bob' }).click();
  await expect(page.getByLabel('Bob display name')).toBeHidden();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove Carla' }).click();
  await expect(page.getByLabel('Carla display name')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove Carla' }).click();
  await expect(page.getByLabel('Carla display name')).toBeHidden();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(opener).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Player 1' })).toHaveValue('Alicia');
  await context.close();
});

test('announces Player Directory API errors', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context, {
    playerFailure: { method: 'PATCH', status: 409, message: 'That Player already exists.' },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage Players' }).click();
  await page.getByLabel('Alice display name').fill('Bob');
  await page.getByRole('button', { name: 'Rename Alice' }).click();
  await expect(page.getByRole('alert')).toHaveText('That Player already exists.');
  await context.close();
});
