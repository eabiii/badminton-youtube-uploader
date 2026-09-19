import { expect, test, type Locator, type Page } from '@playwright/test';
import { MAX_VIDEO_BYTES } from '../../shared/domain';
import { fillRequiredGame, mockApplication, selectPlayer } from './helpers/mock-application';

async function setSyntheticFile(page: Page, name: string, type: string, size: number) {
  await page.getByLabel(/Choose one MP4/).evaluate(
    (input, file) => {
      const selected = new File(['x'], file.name, { type: file.type });
      Object.defineProperty(selected, 'size', { value: file.size });
      const transfer = new (
        globalThis as unknown as {
          DataTransfer: new () => { items: { add: (file: File) => void }; files: FileList };
        }
      ).DataTransfer();
      transfer.items.add(selected);
      Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { name, type, size },
  );
}

async function forceValue(locator: Locator, value: string) {
  await locator.evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter?.call(element, next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('validates required fields, MP4 type and size, and Player uniqueness', async ({ browser }) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');

  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('Select one MP4 file.');
  await setSyntheticFile(page, 'game.mov', 'video/quicktime', 3);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('Select an MP4 file.');
  await setSyntheticFile(page, 'empty.mp4', 'video/mp4', 0);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('The MP4 file must not be empty.');
  await setSyntheticFile(page, 'large.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1);
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('The MP4 file must be no larger than 2 GB.');

  await setSyntheticFile(page, 'game.mp4', 'video/mp4', 3);
  await page.getByLabel('Match Type').selectOption('Singles Match');
  await page.getByLabel('Match Date').fill('2026-09-07');
  await selectPlayer(page, 'Player 1', 'Alice');
  await selectPlayer(page, 'Player 2', 'Alice');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'A Player cannot occupy more than one position in a Game.',
  );
  await context.close();
});

test('switches Singles and Doubles positions and validates Game Number and Description', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Player 4' })).toBeVisible();
  await page.getByLabel('Match Type').selectOption('Singles Match');
  await expect(page.getByRole('combobox', { name: 'Player 3' })).toBeHidden();
  await fillRequiredGame(page);
  await page.getByLabel('Game Number').fill('0');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('Game Number must be a positive whole number.');
  await page.getByLabel('Game Number').fill('1.5');
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('Game Number must be a positive whole number.');
  await page.getByLabel('Game Number').fill('1');
  await forceValue(page.getByLabel(/Description/), 'x'.repeat(5_001));
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Descriptions must be at most 5,000 characters.',
  );
  await expect(page.getByLabel('Requested Visibility').locator('option')).toHaveText([
    'Private',
    'Unlisted',
    'Public',
  ]);
  await context.close();
});

test('generates English titles, applies overrides, and preserves Custom Titles until regeneration', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockApplication(context);
  const page = await context.newPage();
  await page.goto('/');
  await fillRequiredGame(page);
  const title = page.locator('input[maxlength="100"]');
  await expect(title).toHaveValue('Alice vs Bob | Singles Match | September 7, 2026');
  await expect(page.getByText('48/100')).toBeVisible();
  await page.getByLabel('Game Number').fill('2');
  await page.getByLabel('Title Name Override', { exact: false }).first().fill('Al');
  await expect(title).toHaveValue('Al vs Bob | Singles Match | Game 2 | September 7, 2026');
  await title.fill('Custom finals title');
  await page.getByLabel('Match Date').fill('2026-09-08');
  await expect(title).toHaveValue('Custom finals title');
  await expect(page.getByText('19/100')).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate title' }).click();
  await expect(title).toHaveValue('Al vs Bob | Singles Match | Game 2 | September 8, 2026');
  await expect(title).toHaveAttribute('maxlength', '100');
  await forceValue(title, 'x'.repeat(101));
  await expect(page.getByText('101/100')).toBeVisible();
  await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByRole('alert')).toHaveText('Titles must be at most 100 characters.');
  await context.close();
});
