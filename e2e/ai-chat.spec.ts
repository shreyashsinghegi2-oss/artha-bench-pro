import { expect, test } from '@playwright/test';

/**
 * The model call is intercepted (CI has no LLM keys). The real server still builds the response;
 * the test only swaps in a grounded answer with one cited source and checks the UI shows it.
 */
test('AI CFO answer displays its cited source', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    const upstream = await route.fetch();
    const body = await upstream.json();
    body.ok = true;
    body.fallbackUsed = false;
    body.structuredAnswer.title = 'CFO brief: repo rate';
    body.structuredAnswer.directAnswer = 'The RBI policy repo rate in the cited statement is shown in source [1]. Check the latest statement before acting.';
    body.structuredAnswer.sources = [{ name: 'RBI Monetary Policy Statement (e2e fixture)', dataDate: '2026-08-06', freshness: 'official' }];
    body.answer = body.structuredAnswer.directAnswer;
    await route.fulfill({ response: upstream, json: body });
  });

  await page.goto('/');
  const box = page.getByLabel('Ask your AI CFO');
  await box.fill('What is the current repo rate?');
  await box.press('Enter');
  await expect(page.getByText(/source \[1\]/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('RBI Monetary Policy Statement (e2e fixture)').first()).toBeVisible();
});
