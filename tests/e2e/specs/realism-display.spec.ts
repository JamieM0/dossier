import { expect, test } from '@playwright/test';
import { dismissEnrichmentModal, installMockDossier } from './mock-dossier';

test('saved realism claims display the actual lens direction', async ({ page }, testInfo) => {
  await page.addInitScript(installMockDossier, { likedMovies: 8 });
  await page.addInitScript(() => {
    const api = (window as any).dossier.preferences;
    const get = api.get;
    api.get = async () => {
      const state = await get();
      state.tasteClaims = [{ ...state.tasteClaims[0], id: 'saved-realism',
        conditions: [{ kind: 'feature_axis', value: 'realism', side: 'high', label: 'realistic settings' }] }];
      return state;
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dossier');
  await dismissEnrichmentModal(page);
  const claim = page.getByRole('button', { name: /Drawn to fantastical settings/ });
  await expect(claim).toBeVisible();
  await page.screenshot({ path: 'test-results/realism-display-desktop.png', fullPage: true });
  await claim.screenshot({ path: 'test-results/realism-display-card.png' });
  await claim.click();
  const dialog = page.getByRole('dialog', { name: /Evidence for fantastical settings/ });
  await expect(dialog).toBeVisible();
  await dialog.screenshot({ path: 'test-results/realism-display-inspector.png' });
  const audit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped: [...document.querySelectorAll('.claim-card, [role=dialog]')].some(el => el.scrollWidth > el.clientWidth + 1)
  }));
  expect(audit.overflow).toBeLessThanOrEqual(1);
  expect(audit.clipped).toBe(false);
  await testInfo.attach('realism-display-visual-audit', { body: JSON.stringify(audit), contentType: 'application/json' });
});
