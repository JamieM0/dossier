import { expect, test } from '@playwright/test';
import { dismissEnrichmentModal, installMockDossier } from './mock-dossier';

test('desktop recommendations and refinement render with mixed personal evidence', async ({ page }, testInfo) => {
  await page.addInitScript(installMockDossier, { personalEvidence: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await dismissEnrichmentModal(page);
  const card = page.locator('.card').first();
  await expect(card).toBeVisible();
  await page.screenshot({ path: 'test-results/personal-recommendations-desktop.png', fullPage: true });
  await card.screenshot({ path: 'test-results/personal-recommendations-card.png' });
  const audit = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cards: [...document.querySelectorAll('.card')].map(el => ({
      width: el.getBoundingClientRect().width, clipped: el.scrollWidth > el.clientWidth + 1,
      title: el.querySelector('strong')?.textContent
    }))
  }));
  expect(audit.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(audit.cards.every(card => card.width > 0 && !card.clipped && card.title)).toBe(true);
  await testInfo.attach('personal-recommendations-visual-audit', { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
  await page.goto('/refine');
  await dismissEnrichmentModal(page);
  await expect(page.getByRole('heading', { name: 'Which feels more like you?' })).toBeVisible();
  await page.screenshot({ path: 'test-results/personal-refine-desktop.png', fullPage: true });
});
