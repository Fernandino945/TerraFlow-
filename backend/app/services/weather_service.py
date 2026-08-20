import httpx
from datetime import datetime, timezone
from typing import Optional
from app.core.config import settings
from app.models.schemas import WeatherForecast, WeatherSummary

_cache: Optional[WeatherSummary] = None
_cache_timestamp: Optional[datetime] = None

WEATHER_CODES = {
    0: "Despejado",
    1: "Principalmente despejado", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Niebla", 48: "Niebla con escarcha",
    51: "Llovizna leve", 53: "Llovizna moderada", 55: "Llovizna intensa",
    61: "Lluvia leve", 63: "Lluvia moderada", 65: "Lluvia intensa",
    71: "Nieve leve", 73: "Nieve moderada", 75: "Nieve intensa",
    77: "Granizo",
    80: "Lluvia esporádica leve", 81: "Lluvia esporádica moderada", 82: "Lluvia esporádica intensa",
    85: "Nevada esporádica leve", 86: "Nevada esporádica intensa",
    95: "Tormenta", 96: "Tormenta con granizo leve", 99: "Tormenta con granizo fuerte",
}

async def fetch_forecast() -> WeatherSummary:
    url = f"{settings.OPEN_METEO_BASE_URL}/forecast"
    params = {
        "latitude": settings.LATITUDE,
        "longitude": settings.LONGITUDE,
        "hourly": "temperature_2m,precipitation,precipitation_probability,windspeed_10m,weathercode",
        "current_weather": True,
        "forecast_days": 2,
        "timezone": "America/Santiago",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    hourly = data["hourly"]
    current = data["current_weather"]

    all_forecasts = []
    for i in range(len(hourly["time"])):
        all_forecasts.append(WeatherForecast(
            timestamp=datetime.fromisoformat(hourly["time"][i]),
            temperature_2m=hourly["temperature_2m"][i],
            precipitation=hourly["precipitation"][i],
            precipitation_probability=hourly["precipitation_probability"][i],
            windspeed_10m=hourly["windspeed_10m"][i],
            weathercode=hourly["weathercode"][i],
        ))

    # Open-Meteo entrega el pronóstico horario desde las 00:00 del día actual.
    # Filtramos para que arranque en la hora actual (redondeada hacia abajo),
    # así "próximas 12h" siempre significa desde ahora, no desde medianoche.
    now = datetime.now()  # naive, en la misma zona horaria pedida a la API (America/Santiago)
    current_hour_floor = now.replace(minute=0, second=0, microsecond=0)

    forecasts = [f for f in all_forecasts if f.timestamp >= current_hour_floor]

    # Failsafe: si por desfase de zona horaria no quedó ningún elemento, no dejar la lista vacía
    if not forecasts:
        forecasts = all_forecasts

    # Evaluar próximas 12h (ahora sí, desde la hora actual)
    next_12h = forecasts[:12]
    total_rain_12h = sum(f.precipitation for f in next_12h)
    min_temp_12h = min(f.temperature_2m for f in next_12h) if next_12h else current["temperature"]
    max_humidity_risk = any(f.precipitation_probability > 70 for f in next_12h)

    will_rain = total_rain_12h >= settings.RAIN_SUSPENSION_THRESHOLD
    frost_risk = min_temp_12h < settings.FROST_TEMP_THRESHOLD
    saturation_risk = max_humidity_risk and total_rain_12h > 10

    irrigation_suspended = will_rain or frost_risk or saturation_risk
    reason = None
    if will_rain:
        reason = f"Lluvia prevista ({total_rain_12h:.1f}mm en las próximas 12h)"
    elif frost_risk:
        reason = f"Riesgo de helada (mín. {min_temp_12h:.1f}°C)"
    elif saturation_risk:
        reason = "Riesgo de saturación del suelo"

    return WeatherSummary(
        current_temp=current["temperature"],
        current_humidity=None,
        hourly_forecast=forecasts[:24],
        will_rain=will_rain,
        frost_risk=frost_risk,
        saturation_risk=saturation_risk,
        irrigation_suspended=irrigation_suspended,
        suspension_reason=reason,
    )

async def get_forecast() -> WeatherSummary:
    """
    Devuelve el pronóstico cacheado, pero si la hora actual ya avanzó respecto
    a cuándo se generó el caché, lo refresca — para que la ventana de 12h/24h
    siempre arranque desde la hora real en que se consulta, no desde que se cacheó.
    """
    global _cache, _cache_timestamp
    now = datetime.now()
    cache_stale = (
        _cache is None
        or _cache_timestamp is None
        or _cache_timestamp.replace(minute=0, second=0, microsecond=0) != now.replace(minute=0, second=0, microsecond=0)
    )
    if cache_stale:
        await refresh_cache()
    return _cache

async def refresh_cache():
    global _cache, _cache_timestamp
    _cache = await fetch_forecast()
    _cache_timestamp = datetime.now()

def get_weather_description(code: int) -> str:
    return WEATHER_CODES.get(code, "Desconocido")
