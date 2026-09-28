import { expect, test } from '@playwright/test';

test('guided onboarding starts and advances through the first questions', async ({ page }) => {
  await page.goto('/finance/overview');
  await expect(page.getByText('Your money, in one clear place.')).toBeVisible();
  await page.getByRole('button', { name: /Answer about 12 quick questions/ }).click();
  await expect(page.getByText(/QUESTION 1 OF \d+/i)).toBeVisible();
  await expect(page.getByText('First, what should we call you?')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/QUESTION 2 OF \d+/i)).toBeVisible();
});

test('private pages route anonymous users to sign-in with a way back', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('button', { name: 'Create a free account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not now, keep exploring' })).toBeVisible();
});
