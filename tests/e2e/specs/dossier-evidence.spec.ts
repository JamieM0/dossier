import { expect, test } from '@playwright/test';
import { dismissEnrichmentModal, installMockDossier } from './mock-dossier';

test('desktop taste statements show evidence and feedback origin', async ({ page }, testInfo) => {
  await page.addInitScript(installMockDossier, { likedMovies: 8 });
  await page.addInitScript(() => {
    const api = (window as any).dossier.preferences;
    const get = api.get;
    api.get = async () => {
      const state = await get();
      const claim = state.tasteClaims[0];
      state.ratings["movie:1001"].rating = -1;
      state.tasteClaims = [claim, { ...claim, id: 'confirmed', provenance: 'user_confirmed',
        conditions: [{ kind: 'tag', value: 'heist', label: 'Heist' }],
        evidence: { ...claim.evidence, supportingItemKeys: ['movie:1004'], counterexampleItemKeys: ['movie:1001'], supportingWeight: 1, counterexampleWeight: 1, matchedItemCount: 2 } },
        { ...claim, id: 'tentative', confidence: .3,
          conditions: [{ kind: 'tag', value: 'ensemble', label: 'Ensemble' }] }];
      return state;
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dossier');
  await dismissEnrichmentModal(page);
  await expect(page.getByRole('heading', { name: 'Preferences you confirmed' })).toBeVisible();
  await expect(page.getByText('You confirmed', { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-summary').filter({ hasText: '3 supporting · 0 counterexamples' })).toHaveCount(2);
  await expect(page.locator('.dossier-screen')).not.toContainText(/\d+%/);
  await page.screenshot({ path: 'test-results/dossier-evidence-desktop.png', fullPage: true });
  await page.locator('.layers').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.locator('.layers').screenshot({ path: 'test-results/dossier-evidence-cards.png' });
  await page.getByRole('button', { name: /Drawn to heist/ }).click();
  const dialog = page.getByRole('dialog', { name: /Evidence for heist/ });
  await expect(dialog).toContainText('You confirmed');
  await expect(dialog).toContainText('1 supporting · 1 counterexample');
  await expect(dialog).toContainText('Evidence counts do not measure its chance of being correct.');
  await expect(dialog.getByRole('heading', { name: 'Counterexamples' })).toBeVisible();
  await expect(dialog).toContainText('Neon Vector');
  await expect(dialog).not.toContainText(/\d+%/);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/dossier-evidence-inspector.png', fullPage: true });
  await dialog.screenshot({ path: 'test-results/dossier-evidence-inspector-focused.png' });
  const audit = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    evidenceCards: [...document.querySelectorAll('.claim-card')].map(el => {
      const bounds = el.getBoundingClientRect();
      return { text: el.textContent, width: bounds.width, clipped: el.scrollWidth > el.clientWidth + 1 };
    }),
    dialog: (() => { const el = document.querySelector('[role=dialog]')!; const b = el.getBoundingClientRect();
      return { width: b.width, right: b.right, viewportWidth: innerWidth, clipped: el.scrollWidth > el.clientWidth + 1 }; })()
  }));
  expect(audit.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(audit.evidenceCards.every(card => !card.clipped)).toBe(true);
  expect(audit.dialog.clipped).toBe(false);
  expect(audit.dialog.right).toBeLessThanOrEqual(audit.dialog.viewportWidth + 1);
  await testInfo.attach('evidence-visual-audit', { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
});
