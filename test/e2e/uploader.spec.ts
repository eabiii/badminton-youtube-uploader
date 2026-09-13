import { expect, test, type BrowserContext } from '@playwright/test';

const view = { leaseId: 'lease-1', state: 'uploading', uploadedBytes: 0, uploadLength: 3, requestedVisibility: 'Unlisted', effectiveVisibility: 'Private' };
async function mockApplication(context: BrowserContext, status: () => object, chunk: 'pending' | 'success' | 'partial' = 'pending') {
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session') return route.fulfill({ json: { authenticated: true, auditApproved: false, publisherMode: 'fake' } });
    if (path === '/api/upload/status') return route.fulfill({ json: status() });
    if (path === '/api/players') return route.fulfill({ json: { players: [{ id: 'a', displayName: 'Alice' }, { id: 'b', displayName: 'Bob' }] } });
    if (path === '/api/upload/start') return route.fulfill({ status: 201, json: view });
    if (path.endsWith('/chunk')) {
      if (chunk === 'pending') { await new Promise((resolve) => setTimeout(resolve, 10_000)); return route.fulfill({ json: { complete: false, nextOffset: 0 } }); }
      const completed = { ...view, state: chunk === 'partial' ? 'partial_success' : 'uploading', uploadedBytes: 3, videoId: 'video-1',
        watchUrl: 'https://www.youtube.com/watch?v=video-1', studioUrl: 'https://studio.youtube.com/video/video-1/edit' };
      return route.fulfill({ json: { complete: true, nextOffset: 3, upload: completed } });
    }
    if (path.endsWith('/retry-playlist')) return route.fulfill({ json: { ...view, uploadedBytes: 3, videoId: 'video-1', watchUrl: 'https://www.youtube.com/watch?v=video-1', studioUrl: 'https://studio.youtube.com/video/video-1/edit' } });
    return route.fulfill({ status: 204 });
  });
}

async function fillRequiredGame(page: import('@playwright/test').Page) {
  await page.getByLabel('Match Type').selectOption('Singles Match');
  await page.getByLabel('Match Date').fill('2026-09-07');
  await page.getByRole('combobox', { name: 'Player 1' }).click(); await page.getByRole('option', { name: 'Alice' }).click();
  await page.getByRole('combobox', { name: 'Player 2' }).click(); await page.getByRole('option', { name: 'Bob' }).click();
  await page.getByLabel(/Choose one MP4/).setInputFiles({ name: 'game.mp4', mimeType: 'video/mp4', buffer: Buffer.from('abc') });
}

test('selects the Game video by drag and drop', async ({ browser }) => {
  const context = await browser.newContext(); await mockApplication(context, () => ({ busy: false }));
  const page = await context.newPage(); await page.goto('/');
  const transfer = await page.evaluateHandle(`(() => {
    const data = new DataTransfer(); data.items.add(new File(['abc'], 'dropped-game.mp4', { type: 'video/mp4' })); return data;
  })()`);
  const dropTarget = page.locator('.file-drop'); await dropTarget.dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(dropTarget).toHaveClass(/drag-active/); await dropTarget.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(dropTarget).not.toHaveClass(/drag-active/); await expect(page.getByText('dropped-game.mp4')).toBeVisible();
  await expect(page.getByText('0.0 MB')).toBeVisible(); await context.close();
});

test('defaults new Game Uploads to Doubles Match', async ({ browser }) => {
  const context = await browser.newContext(); await mockApplication(context, () => ({ busy: false }));
  const page = await context.newPage(); await page.goto('/');
  await expect(page.getByLabel('Match Type')).toHaveValue('Doubles Match');
  await expect(page.getByRole('combobox', { name: 'Player 4' })).toBeVisible(); await context.close();
});

test('separate Uploader contexts see the single global upload slot', async ({ browser }) => {
  let busy = false; const first = await browser.newContext(); const second = await browser.newContext();
  await mockApplication(first, () => ({ busy: false })); await mockApplication(second, () => ({ busy }));
  const page = await first.newPage(); await page.goto('/'); await fillRequiredGame(page);
  busy = true; await page.getByRole('button', { name: 'Start Game Upload' }).click(); await expect(page.getByRole('button', { name: 'Cancel upload' })).toBeVisible();
  const otherPage = await second.newPage(); await otherPage.goto('/'); await expect(otherPage.getByRole('heading', { name: 'Another Game Upload is active' })).toBeVisible();
  await first.close(); await second.close();
});

test('confirms Public, reports effective Private, and Upload another retains only Match Date', async ({ browser }) => {
  const context = await browser.newContext(); await mockApplication(context, () => ({ busy: false }), 'success');
  const page = await context.newPage(); await page.goto('/'); await fillRequiredGame(page);
  const title = page.getByRole('textbox', { name: /^Title \d/ }); await title.fill('Custom finals title'); await page.getByLabel('Match Date').fill('2026-09-08');
  await expect(title).toHaveValue('Custom finals title'); await page.getByRole('button', { name: 'Regenerate title' }).click();
  await expect(title).toHaveValue(/September 8, 2026/);
  await page.getByLabel('Requested Visibility').selectOption('Public'); page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start Game Upload' }).click(); await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible();
  await expect(page.getByText(/Effective Visibility: Private/)).toBeVisible(); await expect(page.getByRole('link', { name: /YouTube Studio/ })).toHaveAttribute('href', /video-1/);
  await page.getByRole('button', { name: 'Upload another' }).click(); expect(await page.getByLabel('Match Date').inputValue()).toBe('2026-09-08');
  expect(await page.getByLabel('Match Type').inputValue()).toBe('Doubles Match');
  expect(await page.getByLabel('Requested Visibility').inputValue()).toBe('Unlisted'); expect(await page.getByRole('combobox', { name: 'Player 1' }).inputValue()).toBe('');
  await context.close();
});

test('recovers Partial Success with a playlist-only retry', async ({ browser }) => {
  const context = await browser.newContext(); let chunks = 0;
  await mockApplication(context, () => ({ busy: false }), 'partial');
  context.on('request', (request) => { if (new URL(request.url()).pathname.endsWith('/chunk')) chunks += 1; });
  const page = await context.newPage(); await page.goto('/'); await fillRequiredGame(page); await page.getByRole('button', { name: 'Start Game Upload' }).click();
  await expect(page.getByText('Partial Success', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Retry playlist addition' }).click();
  await expect(page.getByRole('heading', { name: 'Game uploaded' })).toBeVisible(); expect(chunks).toBe(1); await context.close();
});

test('an interrupted owner releases the lease and restarts from an empty file', async ({ browser }) => {
  const context = await browser.newContext(); await mockApplication(context, () => ({ busy: true, upload: view }));
  const page = await context.newPage(); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Restart this Game Upload' })).toBeVisible();
  await page.getByRole('button', { name: 'Release and restart' }).click(); await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible();
  await expect(page.getByText('Drag and drop one MP4 file here')).toBeVisible(); await context.close();
});

test('shared-password login reaches the form and cancellation releases the current upload', async ({ browser }) => {
  const context = await browser.newContext(); let signedIn = false; let cancelled = false;
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session' && !signedIn) return route.fulfill({ status: 401, json: { error: 'Authentication required.' } });
    if (path === '/api/login') { signedIn = true; return route.fulfill({ json: { authenticated: true } }); }
    if (path === '/api/session') return route.fulfill({ json: { authenticated: true, auditApproved: false, publisherMode: 'fake' } });
    if (path === '/api/upload/status') return route.fulfill({ json: { busy: false } });
    if (path === '/api/players') return route.fulfill({ json: { players: [{ id: 'a', displayName: 'Alice' }, { id: 'b', displayName: 'Bob' }] } });
    if (path === '/api/upload/start') return route.fulfill({ status: 201, json: view });
    if (path.endsWith('/cancel')) { cancelled = true; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/chunk')) { await new Promise((resolve) => setTimeout(resolve, 10_000)); return route.fulfill({ json: { complete: false, nextOffset: 0 } }); }
    return route.fulfill({ status: 204 });
  });
  const page = await context.newPage(); await page.goto('/'); await page.getByLabel('Shared password').fill('shared password'); await page.getByRole('button', { name: 'Sign in' }).click();
  await fillRequiredGame(page); await page.getByRole('button', { name: 'Start Game Upload' }).click(); await page.getByRole('button', { name: 'Cancel upload' }).click();
  await expect(page.getByRole('heading', { name: 'Publish one badminton Game' })).toBeVisible(); expect(cancelled).toBe(true); await context.close();
});
