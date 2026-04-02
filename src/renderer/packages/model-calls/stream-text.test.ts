import { describe, expect, it } from 'vitest'
import { extractWeatherLocation, shouldLaunchChessApp } from './stream-text'

describe('stream-text app routing helpers', () => {
  it('detects common chess launch phrases', () => {
    expect(shouldLaunchChessApp("let's play chess")).toBe(true)
    expect(shouldLaunchChessApp('open chess for me')).toBe(true)
    expect(shouldLaunchChessApp('start chess')).toBe(true)
    expect(shouldLaunchChessApp('what is the capital of France?')).toBe(false)
  })

  it('extracts weather locations from common prompts', () => {
    expect(extractWeatherLocation("what's the weather in Austin?")).toBe('Austin')
    expect(extractWeatherLocation('weather in Chicago today')).toBe('Chicago')
    expect(extractWeatherLocation('forecast for London tomorrow')).toBe('London')
    expect(extractWeatherLocation('temperature for New York right now')).toBe('New York')
    expect(extractWeatherLocation('how is the weather looking in Seattle?')).toBe('Seattle')
  })

  it('does not route unrelated prompts to weather', () => {
    expect(extractWeatherLocation('tell me a joke')).toBeNull()
    expect(extractWeatherLocation('show me something')).toBeNull()
  })
})
