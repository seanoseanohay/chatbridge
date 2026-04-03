const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-production-062e.up.railway.app'
const ARTIFACT_DIR = path.resolve(__dirname, '../test-results/hosted-smoke')

async function sendPrompt(page, prompt) {
  const input = page.locator('#message-input')
  await input.click()
  await input.fill(prompt)
  await input.press('Enter')
}

async function expectVisible(page, text, timeout = 20000) {
  await page.getByText(text, { exact: false }).waitFor({ state: 'visible', timeout })
}

async function runCase(page, name, prompt, expectedTexts) {
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#message-input', { timeout: 20000 })
  await sendPrompt(page, prompt)

  try {
    for (const text of expectedTexts) {
      await expectVisible(page, text)
    }
  } catch (error) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${name}-failure.png`), fullPage: true })
    console.error(JSON.stringify({
      case: name,
      url: page.url(),
      bodyText: (await page.locator('body').innerText()).slice(0, 2000),
    }, null, 2))
    throw error
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, `${name}.png`), fullPage: true })
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })
  page.on('console', (message) => {
    console.log(`[browser:${message.type()}] ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.message}`)
  })

  try {
    await runCase(page, 'chess', 'lets play chess', [
      'Chess is ready in the app panel.',
      'App Panel',
      'chess-v1',
    ])

    await runCase(page, 'weather', "what's the weather in Austin?", [
      'weather-v1',
      'App Panel',
      'Austin',
    ])

    console.log(JSON.stringify({
      ok: true,
      frontend: FRONTEND_URL,
      artifacts: ARTIFACT_DIR,
    }))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
