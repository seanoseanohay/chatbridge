export type DeterministicAppPrompt =
  | { app: 'chess' }
  | { app: 'spotify' }
  | { app: 'weather'; location: string }

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

export function shouldLaunchSpotifyApp(text: string) {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('spotify') &&
    (normalized.includes('open') ||
      normalized.includes('login') ||
      normalized.includes('log in') ||
      normalized.includes('sign in') ||
      normalized.includes('connect') ||
      normalized.includes('playlist'))
  )
}

export function getDeterministicAppPrompt(text: string): DeterministicAppPrompt | null {
  if (shouldLaunchChessApp(text)) {
    return { app: 'chess' }
  }

  if (shouldLaunchSpotifyApp(text)) {
    return { app: 'spotify' }
  }

  const location = extractWeatherLocation(text)
  if (location) {
    return { app: 'weather', location }
  }

  return null
}
