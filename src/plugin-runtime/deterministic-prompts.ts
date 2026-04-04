export type DeterministicAppPrompt =
  | { app: 'chess' }
  | { app: 'github' }
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

export function shouldLaunchGitHubApp(text: string) {
  const normalized = text.toLowerCase()
  const hasGitHub = /\bgithub\b/.test(normalized)
  const hasLaunchIntent =
    /\b(open|launch|start|connect|authorize|auth|use)\b/.test(normalized) ||
    /\blogin\b/.test(normalized) ||
    /\blog in\b/.test(normalized) ||
    /\blog me in(to)?\b/.test(normalized) ||
    /\bsign in\b/.test(normalized) ||
    /\bsign me in(to)?\b/.test(normalized) ||
    /\bpull request\b/.test(normalized) ||
    /\bprs?\b/.test(normalized) ||
    /\bissues?\b/.test(normalized) ||
    /\brepo\b/.test(normalized)

  return hasGitHub && hasLaunchIntent
}

export function getDeterministicAppPrompt(text: string): DeterministicAppPrompt | null {
  if (shouldLaunchChessApp(text)) {
    return { app: 'chess' }
  }

  if (shouldLaunchGitHubApp(text)) {
    return { app: 'github' }
  }

  const location = extractWeatherLocation(text)
  if (location) {
    return { app: 'weather', location }
  }

  return null
}
