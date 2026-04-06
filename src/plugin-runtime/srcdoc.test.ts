import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createChessAppSrcDoc } from '../apps/chess/srcdoc'
import { createGitHubAppSrcDoc } from '../apps/github/srcdoc'
import { createWeatherAppSrcDoc } from '../apps/weather/srcdoc'

function extractInlineScripts(html: string) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
  if (!matches.length) {
    throw new Error('Expected inline script in srcdoc output')
  }
  return matches
}

function expectValidInlineScript(script: string) {
  expect(() => new Function(script)).not.toThrow()
}

function expectAllInlineScriptsValid(html: string) {
  for (const script of extractInlineScripts(html)) {
    expectValidInlineScript(script)
  }
}

describe('app srcdoc bundles', () => {
  it('produces valid inline JavaScript for the chess app', () => {
    const html = createChessAppSrcDoc()

    expect(html).toContain('persistSessionState')
    expect(html).toContain('restoreFromSnapshot')
    expectAllInlineScriptsValid(html)
  })

  it('produces valid inline JavaScript for the weather app', () => {
    const html = createWeatherAppSrcDoc()

    expect(html).toContain('[hidden]')
    expectAllInlineScriptsValid(html)
  })

  it('produces valid inline JavaScript for the GitHub app', () => {
    const html = createGitHubAppSrcDoc()

    expect(html).toContain('[hidden]')
    expect(html).not.toContain(".replace(/\\/$/, '')")
    expectAllInlineScriptsValid(html)
  })

  it('keeps the srcdoc factories transpile-safe', () => {
    const weatherOutput = ts.transpileModule("export { createWeatherAppSrcDoc } from '../apps/weather/srcdoc'", {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText
    const chessOutput = ts.transpileModule("export { createChessAppSrcDoc } from '../apps/chess/srcdoc'", {
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

    expect(chessOutput).toContain('createChessAppSrcDoc')
    expect(weatherOutput).toContain('createWeatherAppSrcDoc')
    expect(githubOutput).toContain('createGitHubAppSrcDoc')
  })
})
