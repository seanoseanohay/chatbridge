export type DeterministicAppPrompt =
  | { app: 'chess' }
  | { app: 'weather'; location: string }
  | { app: 'spotify'; prompt: string; trackCount?: number }

export function shouldLaunchChessApp(text: string) {
  const normalized = text.toLowerCase()
  return (
    normalized.includes("let's play chess") ||
    normalized.includes('lets play chess') ||
    normalized.includes('play chess') ||
    normalized.includes('start chess') ||
    normalized.includes('open chess')
  )
}

export function extractWeatherLocation(text: string) {
  const normalized = text.trim()
  const patterns = [
    /(?:what(?:'s| is) the weather(?: like)? in|show (?:me )?(?:the )?weather in|weather in|forecast (?:for|in)|weather for|temperature (?:in|for)|conditions (?:in|for)|is it (?:raining|snowing|sunny|cloudy|humid|windy|hot|cold) in)\s+(.+?)[?.!]*$/i,
    /(?:how(?:'s| is) the weather(?: looking)? in)\s+(.+?)[?.!]*$/i,
    /^(.+?)\s+weather[?.!]*$/i,
    /^forecast\s+(.+?)[?.!]*$/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      return match[1].trim().replace(/\b(today|tomorrow|right now)\b$/i, '').trim()
    }
  }

  return null
}

export function getDeterministicAppPrompt(text: string): DeterministicAppPrompt | null {
  if (shouldLaunchChessApp(text)) {
    return { app: 'chess' }
  }

  const location = extractWeatherLocation(text)
  if (location) {
    return { app: 'weather', location }
  }

  const spotifyPrompt = extractSpotifyPrompt(text)
  if (spotifyPrompt) {
    return spotifyPrompt
  }

  return null
}

export function extractSpotifyPrompt(text: string): DeterministicAppPrompt | null {
  const normalized = text.trim()
  if (!normalized) {
    return null
  }

  const lower = normalized.toLowerCase()
  const mentionsSpotify = lower.includes('spotify')
  const mentionsPlaylist =
    lower.includes('playlist') &&
    (lower.includes('make') ||
      lower.includes('create') ||
      lower.includes('build') ||
      lower.includes('open') ||
      lower.includes('connect') ||
      lower.includes('login') ||
      lower.includes('log in'))

  if (!mentionsSpotify && !mentionsPlaylist) {
    return null
  }

  const trackCountMatch = normalized.match(/(\d+)\s+(?:song|songs|track|tracks)\b/i)
  const trackCount = trackCountMatch ? Number.parseInt(trackCountMatch[1], 10) : undefined

  return {
    app: 'spotify',
    prompt: normalized,
    ...(trackCount ? { trackCount } : {}),
  }
}
