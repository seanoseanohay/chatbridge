import { Router } from 'express'
import { z } from 'zod'

const WeatherQuerySchema = z.object({
  location: z.string().min(1),
})

type OpenMeteoGeocodeResult = {
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
}

type OpenMeteoGeocodeResponse = {
  results?: OpenMeteoGeocodeResult[]
}

type OpenMeteoForecastResponse = {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    weather_code: number[]
  }
}

function wmoCodeToDescription(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1 || code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Foggy'
  if (code === 51 || code === 53 || code === 55) return 'Drizzle'
  if (code === 61 || code === 63 || code === 65) return 'Rainy'
  if (code === 71 || code === 73 || code === 75) return 'Snowing'
  if (code === 77) return 'Snow grains'
  if (code === 80 || code === 81 || code === 82) return 'Rain showers'
  if (code === 85 || code === 86) return 'Snow showers'
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorm'
  return 'Unknown conditions'
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

    const geocode = await fetchJson<OpenMeteoGeocodeResponse>(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(location) +
        '&count=1&language=en&format=json'
    )

    if (!geocode.results || geocode.results.length === 0) {
      response.status(404).json({
        error: 'location_not_found',
        location,
        message: `Location not found: ${location}`,
      })
      return
    }

    const place = geocode.results[0]
    const forecast = await fetchJson<OpenMeteoForecastResponse>(
      'https://api.open-meteo.com/v1/forecast?' +
        `latitude=${encodeURIComponent(place.latitude)}` +
        `&longitude=${encodeURIComponent(place.longitude)}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
        '&daily=weather_code,temperature_2m_max' +
        '&timezone=auto' +
        '&temperature_unit=fahrenheit' +
        '&wind_speed_unit=mph'
    )

    const current = forecast.current
    const resolvedLocation = [place.name, place.admin1, place.country].filter(Boolean).join(', ')

    // Take daily forecasts, up to 5 days
    const nextDays = forecast.daily.time.slice(0, 5).map((dateStr, index) => {
      const date = new Date(dateStr + 'T00:00:00')
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        temperatureF: Math.round(forecast.daily.temperature_2m_max[index]),
        description: wmoCodeToDescription(forecast.daily.weather_code[index]),
      }
    })

    response.json({
      location: resolvedLocation,
      temperatureF: Math.round(current.temperature_2m),
      description: wmoCodeToDescription(current.weather_code),
      feelsLikeF: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windMph: Math.round(current.wind_speed_10m),
      forecast: nextDays,
    })
  } catch (error) {
    next(error)
  }
})
