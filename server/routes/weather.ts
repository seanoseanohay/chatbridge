import { Router } from 'express'
import { z } from 'zod'

const WeatherQuerySchema = z.object({
  location: z.string().min(1),
})

type GeocodeEntry = {
  name: string
  admin1?: string
  country?: string
  country_code?: string
  latitude: number
  longitude: number
}

type GeocodeResponse = {
  results?: GeocodeEntry[]
}

type ForecastResponse = {
  current?: {
    temperature_2m?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    wind_speed_10m?: number
    weather_code?: number
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

function describeWeatherCode(code: number | undefined) {
  const lookup: Record<number, string> = {
    0: 'clear sky',
    1: 'mainly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'depositing rime fog',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'dense drizzle',
    56: 'light freezing drizzle',
    57: 'freezing drizzle',
    61: 'slight rain',
    63: 'rain',
    65: 'heavy rain',
    66: 'light freezing rain',
    67: 'freezing rain',
    71: 'slight snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'rain showers',
    81: 'heavy rain showers',
    82: 'violent rain showers',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with hail',
    99: 'severe thunderstorm with hail',
  }

  return lookup[code ?? -1] || 'unavailable'
}

function toResolvedLocation(place: GeocodeEntry) {
  return [place.name, place.admin1, place.country || place.country_code].filter(Boolean).join(', ')
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

function scorePlace(place: GeocodeEntry, location: string) {
  const query = location.toLowerCase()
  const normalizedName = place.name.toLowerCase()
  const admin1 = (place.admin1 || '').toLowerCase()
  const country = (place.country || place.country_code || '').toLowerCase()

  let score = 0
  if (normalizedName === query) {
    score += 10
  }
  if (query.includes(normalizedName)) {
    score += 5
  }
  if (query.includes(admin1)) {
    score += 4
  }
  if (query.includes('united states') && (country === 'united states' || country === 'us')) {
    score += 3
  }
  return score
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export const weatherRouter = Router()

weatherRouter.get('/', async (request, response, next) => {
  try {
    const { location } = WeatherQuerySchema.parse(request.query)
    const normalizedLocation = normalizeLocationQuery(location)

    const geocode = await fetchJson<GeocodeResponse>(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(normalizedLocation) +
        '&count=10&language=en&format=json'
    )

    const place = Array.isArray(geocode.results)
      ? [...geocode.results].sort((left, right) => scorePlace(right, normalizedLocation) - scorePlace(left, normalizedLocation))[0]
      : null
    if (!place) {
      response.status(404).json({
        error: 'location_not_found',
        location,
        message: `Location not found: ${location}`,
      })
      return
    }

    const forecast = await fetchJson<ForecastResponse>(
      'https://api.open-meteo.com/v1/forecast?latitude=' +
        encodeURIComponent(place.latitude) +
        '&longitude=' +
        encodeURIComponent(place.longitude) +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5'
    )

    if (!forecast.current || !forecast.daily?.time?.length) {
      response.status(502).json({
        error: 'forecast_unavailable',
        location,
        message: `Forecast unavailable for ${location}`,
      })
      return
    }

    const resolvedLocation = toResolvedLocation(place)
    const dayNames = forecast.daily.time
    const dailyCodes = forecast.daily.weather_code || []
    const dailyHighs = forecast.daily.temperature_2m_max || []
    const dailyLows = forecast.daily.temperature_2m_min || []

    response.json({
      location: resolvedLocation,
      temperatureF: Math.round(forecast.current.temperature_2m || 0),
      description: describeWeatherCode(forecast.current.weather_code),
      feelsLikeF: Math.round(forecast.current.apparent_temperature || 0),
      humidity: Math.round(forecast.current.relative_humidity_2m || 0),
      windMph: Math.round(forecast.current.wind_speed_10m || 0),
      forecast: dayNames.slice(0, 5).map((day, index) => ({
        day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
        temperatureF: Math.round(dailyHighs[index] || 0),
        lowTemperatureF: Math.round(dailyLows[index] || 0),
        description: describeWeatherCode(dailyCodes[index]),
      })),
    })
  } catch (error) {
    next(error)
  }
})
