import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config'

const WeatherQuerySchema = z.object({
  location: z.string().min(1),
})

type GeocodeEntry = {
  name: string
  state?: string
  country: string
  lat: number
  lon: number
}

type ForecastEntry = {
  dt: number
  main: {
    temp: number
    feels_like: number
    humidity: number
  }
  weather: Array<{
    description: string
  }>
  wind: {
    speed: number
  }
}

type ForecastResponse = {
  list: ForecastEntry[]
}

function describeConditions(item: ForecastEntry) {
  return item.weather?.[0]?.description || 'clear conditions'
}

function summarizeForecast(list: ForecastEntry[]) {
  const daily = new Map<string, ForecastEntry>()
  for (const item of list) {
    const dateKey = new Date(item.dt * 1000).toISOString().slice(0, 10)
    if (!daily.has(dateKey)) {
      daily.set(dateKey, item)
    }
  }
  return Array.from(daily.values()).slice(0, 5)
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
    if (!env.OPENWEATHER_API_KEY) {
      response.status(503).json({ error: 'not_configured', message: 'Weather API is not configured.' })
      return
    }

    const geocode = await fetchJson<GeocodeEntry[]>(
      'https://api.openweathermap.org/geo/1.0/direct?q=' +
        encodeURIComponent(location) +
        '&limit=1&appid=' +
        encodeURIComponent(env.OPENWEATHER_API_KEY)
    )

    if (!Array.isArray(geocode) || geocode.length === 0) {
      response.status(404).json({
        error: 'location_not_found',
        location,
        message: `Location not found: ${location}`,
      })
      return
    }

    const place = geocode[0]
    const forecast = await fetchJson<ForecastResponse>(
      'https://api.openweathermap.org/data/2.5/forecast?lat=' +
        encodeURIComponent(place.lat) +
        '&lon=' +
        encodeURIComponent(place.lon) +
        '&units=imperial&appid=' +
        encodeURIComponent(env.OPENWEATHER_API_KEY)
    )

    const current = forecast.list[0]
    const nextDays = summarizeForecast(forecast.list)
    const resolvedLocation = [place.name, place.state, place.country].filter(Boolean).join(', ')

    response.json({
      location: resolvedLocation,
      temperatureF: Math.round(current.main.temp),
      description: describeConditions(current),
      feelsLikeF: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      windMph: Math.round(current.wind.speed),
      forecast: nextDays.map((item) => ({
        day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
        temperatureF: Math.round(item.main.temp),
        description: describeConditions(item),
      })),
    })
  } catch (error) {
    next(error)
  }
})
