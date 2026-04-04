import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createGitHubAppSrcDoc } from '../apps/github/srcdoc'
import { createWeatherAppSrcDoc } from '../apps/weather/srcdoc'

function extractInlineScript(html: string) {
  const match = html.match(/<script>([\s\S]*)<\/script>/)
  if (!match) {
    throw new Error('Expected inline script in srcdoc output')
  }
  return match[1]
}

function expectValidInlineScript(script: string) {
  expect(() => new Function(script)).not.toThrow()
}

describe('app srcdoc bundles', () => {
  it('produces valid inline JavaScript for the weather app', () => {
    const html = createWeatherAppSrcDoc()

    expect(html).toContain('[hidden]')
    expectValidInlineScript(extractInlineScript(html))
  })

  it('produces valid inline JavaScript for the GitHub app', () => {
    const html = createGitHubAppSrcDoc()

    expect(html).toContain('[hidden]')
    expect(html).not.toContain(".replace(/\\/$/, '')")
    expectValidInlineScript(extractInlineScript(html))
  })

  it('keeps the srcdoc factories transpile-safe', () => {
    const weatherOutput = ts.transpileModule("export { createWeatherAppSrcDoc } from '../apps/weather/srcdoc'", {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText
    const githubOutput = ts.transpileModule("export { createGitHubAppSrcDoc } from '../apps/github/srcdoc'", {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText

    expect(weatherOutput).toContain('createWeatherAppSrcDoc')
    expect(githubOutput).toContain('createGitHubAppSrcDoc')
  })
})
