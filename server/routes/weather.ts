import { Router } from 'express'
import { z } from 'zod'

const WeatherQuerySchema = z.object({
  location: z.string().min(1),
})

type NominatimEntry = {
  lat: string
  lon: string
  name?: string
  display_name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    hamlet?: string
    state?: string
    country?: string
    country_code?: string
  }
}

type WeatherGovPointsResponse = {
  properties?: {
    forecast?: string
    forecastHourly?: string
    relativeLocation?: {
      properties?: {
        city?: string
        state?: string
      }
    }
  }
}

type WeatherGovForecastResponse = {
  properties?: {
    periods?: Array<{
      name: string
      isDaytime: boolean
      temperature: number
      temperatureUnit: string
      windSpeed: string
      windDirection: string
      shortForecast: string
    }>
  }
}

function describeWeatherShortForecast(forecast: string | undefined) {
  return forecast || 'unavailable'
}

const US_STATE_ALIASES: Record<string, string> = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
}

function normalizeLocationQuery(location: string) {
  const normalized = location.trim().replace(/\s+/g, ' ')
  const match = normalized.match(/^(.+?)[,\s]+([A-Za-z]{2})$/)
  if (!match) {
    return normalized
  }

  const stateName = US_STATE_ALIASES[match[2].toLowerCase()]
  if (!stateName) {
    return normalized
  }

  return `${match[1]}, ${stateName}, United States`
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

async function fetchNominatimJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'chatbridge-weather/1.0',
    },
  })
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

function formatLocationName(entry: NominatimEntry): string {
  const city = entry.name || entry.address?.city || entry.address?.town || entry.address?.village || entry.address?.hamlet
  const state = entry.address?.state
  const country = entry.address?.country

  const parts = [city, state, country].filter(Boolean)
  return parts.join(', ') || 'Unknown location'
}

export const weatherRouter = Router()

weatherRouter.get('/', async (request, response, next) => {
  try {
    const { location } = WeatherQuerySchema.parse(request.query)
    const normalizedLocation = normalizeLocationQuery(location)

    // Geocode using Nominatim (OSM) to get lat/lon
    const geocodeResults = await fetchNominatimJson<NominatimEntry[]>(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(normalizedLocation)
    )

    if (!Array.isArray(geocodeResults) || !geocodeResults.length) {
      response.status(404).json({
        error: 'location_not_found',
        location,
        message: `Location not found: ${location}`,
      })
      return
    }

    const place = geocodeResults[0]
    const lat = Number(place.lat)
    const lon = Number(place.lon)
    const locationName = formatLocationName(place)

    // Get weather.gov grid point for this location
    const pointsResponse = await fetchJson<WeatherGovPointsResponse>(
      `https://api.weather.gov/points/${lat},${lon}`
    )

    const forecastUrl = pointsResponse.properties?.forecast
    if (!forecastUrl) {
      response.status(502).json({
        error: 'forecast_unavailable',
        location,
        message: `Forecast unavailable for ${location}`,
      })
      return
    }

    // Get the forecast from weather.gov
    const forecastResponse = await fetchJson<WeatherGovForecastResponse>(forecastUrl)
    const periods = forecastResponse.properties?.periods || []

    if (!periods.length) {
      response.status(502).json({
        error: 'forecast_unavailable',
        location,
        message: `Forecast unavailable for ${location}`,
      })
      return
    }

    // Extract current conditions (first period) and daily forecast
    const current = periods[0]
    const currentTemp = current?.temperature || 0
    const currentDescription = current?.shortForecast || 'unavailable'

    // Get daily highs/lows from daytime periods
    const dailyPeriods = periods.filter((p) => p.isDaytime).slice(0, 5)

    response.json({
      location: locationName,
      temperatureF: currentTemp,
      description: currentDescription,
      feelsLikeF: currentTemp,
      humidity: 0,
      windMph: 0,
      forecast: dailyPeriods.map((period) => ({
        day: period.name,
        temperatureF: period.temperature,
        lowTemperatureF: 0,
        description: period.shortForecast,
      })),
    })
  } catch (error) {
    next(error)
  }
})
