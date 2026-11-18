import { expect, test } from '@playwright/test';
import { config } from 'dotenv';

// Logs in as the seeded admin (`npm run db:seed`), using the credentials from server/.env.
config({ path: 'server/.env', quiet: true });
const adminEmail = process.env.ADMIN_EMAIL!;
const adminPassword = process.env.ADMIN_PASSWORD!;

test('signed-out users are sent to the login page', async ({ page }) => {
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
});

test('admin logs in, sees the dashboard, tickets and Users pages, and logs out', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Tickets' })
    .click();
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('cell', { name: adminEmail })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
