import { describe, expect, it } from 'vitest'
import { extractWeatherLocation, shouldLaunchChessApp, shouldLaunchSpotifyApp } from '../../../plugin-runtime/deterministic-prompts'
import { summarizeWeatherToolResult } from './stream-text'

describe('stream-text app routing helpers', () => {
  it('detects common chess launch phrases', () => {
    expect(shouldLaunchChessApp("let's play chess")).toBe(true)
    expect(shouldLaunchChessApp('open chess for me')).toBe(true)
    expect(shouldLaunchChessApp('start chess')).toBe(true)
    expect(shouldLaunchChessApp('what is the capital of France?')).toBe(false)
  })

  it('detects common spotify launch phrases', () => {
    expect(shouldLaunchSpotifyApp('open spotify')).toBe(true)
    expect(shouldLaunchSpotifyApp('log in to spotify')).toBe(true)
    expect(shouldLaunchSpotifyApp('connect spotify')).toBe(true)
    expect(shouldLaunchSpotifyApp('make me a spotify playlist')).toBe(true)
    expect(shouldLaunchSpotifyApp('tell me a joke')).toBe(false)
  })

  it('extracts weather locations from common prompts', () => {
    expect(extractWeatherLocation("what's the weather in Austin?")).toBe('Austin')
    expect(extractWeatherLocation('weather in Chicago today')).toBe('Chicago')
    expect(extractWeatherLocation('forecast for London tomorrow')).toBe('London')
    expect(extractWeatherLocation('temperature for New York right now')).toBe('New York')
    expect(extractWeatherLocation('how is the weather looking in Seattle?')).toBe('Seattle')
    expect(extractWeatherLocation('show me the weather in Miami')).toBe('Miami')
    expect(extractWeatherLocation('is it raining in Boston?')).toBe('Boston')
    expect(extractWeatherLocation('Austin weather')).toBe('Austin')
    expect(extractWeatherLocation('forecast Paris')).toBe('Paris')
  })

  it('does not route unrelated prompts to weather', () => {
    expect(extractWeatherLocation('tell me a joke')).toBeNull()
    expect(extractWeatherLocation('show me something')).toBeNull()
  })

  it('summarizes weather tool results with usable failure context', () => {
    expect(
      summarizeWeatherToolResult('Austin', {
        location: 'Austin, TX, US',
        temperatureF: 72,
        description: 'clear sky',
      })
    ).toBe('Austin, TX, US is 72°F with clear sky.')

    expect(
      summarizeWeatherToolResult('Atlantis', {
        error: 'location_not_found',
        message: 'Location not found: Atlantis',
      })
    ).toBe('Weather lookup failed for Atlantis. Location not found: Atlantis')
  })
})
