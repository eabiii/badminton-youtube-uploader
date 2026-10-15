import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApplication } from './helpers/mock-application';

test('signed-out home explains the application and links to the privacy policy', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context, { authenticated: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What this application does' })).toBeVisible();
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await context.close();
});

test('privacy policy is public, states Google disclosures, and is accessible', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const state = await mockApplication(context, { authenticated: false });
  const page = await context.newPage();
  await page.goto('/privacy');
  await expect(page.getByText('Limited Use requirements')).toBeVisible();
  await expect(page.getByRole('link', { name: 'YouTube Terms of Service' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Badminton Uploader' })).toHaveAttribute(
    'href',
    '/',
  );
  expect(state.starts).toHaveLength(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await context.close();
});
