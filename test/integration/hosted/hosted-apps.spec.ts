import { expect, test } from 'playwright/test'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-production-062e.up.railway.app'

async function sendPrompt(page: import('playwright/test').Page, prompt: string) {
  const input = page.locator('#message-input')
  await input.click()
  await input.fill(prompt)
  await input.press('Enter')
}

test.describe('hosted app panel flows', () => {
  test('launches chess without model setup', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' })
    await sendPrompt(page, 'lets play chess')

    await expect(page.getByText('Chess is ready in the app panel.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('App Panel')).toBeVisible()
    await expect(page.getByText('chess-v1')).toBeVisible()
  })

  test('launches weather without model setup', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' })
    await sendPrompt(page, "what's the weather in Austin?")

    await expect(page.getByText(/Austin/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('App Panel')).toBeVisible()
    await expect(page.getByText('weather-v1')).toBeVisible()
  })
})
