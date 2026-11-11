import asyncio
from datetime import datetime, timedelta

import httpx
import pytest

from app.services import weather_service


def forecast_data(precipitation=0.0, temperature=15.0, probability=10):
    base = datetime.now().replace(minute=0, second=0, microsecond=0)
    times = [(base + timedelta(hours=index)).strftime("%Y-%m-%dT%H:%M") for index in range(24)]
    return {
        "hourly": {
            "time": times,
            "temperature_2m": [temperature] * 24,
            "precipitation": [precipitation] * 24,
            "precipitation_probability": [probability] * 24,
            "windspeed_10m": [5.0] * 24,
            "weathercode": [0] * 24,
        },
        "current_weather": {"temperature": temperature},
    }


@pytest.fixture
def fetch(monkeypatch):
    real_client = httpx.AsyncClient

    def run(data):
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json=data))
        monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: real_client(transport=transport))
        return asyncio.run(weather_service.fetch_forecast())

    return run


def test_rain_suspends_irrigation(fetch):
    summary = fetch(forecast_data(precipitation=1.0))
    assert summary.will_rain is True
    assert summary.irrigation_suspended is True


def test_low_rain_does_not_suspend(fetch):
    summary = fetch(forecast_data(precipitation=0.4))
    assert summary.irrigation_suspended is False


def test_frost_suspends_irrigation(fetch):
    summary = fetch(forecast_data(temperature=3.0))
    assert summary.frost_risk is True
    assert summary.irrigation_suspended is True


def test_forecast_is_limited_to_24_hours(fetch):
    assert len(fetch(forecast_data()).hourly_forecast) == 24


def test_unknown_weather_code_has_fallback():
    assert weather_service.get_weather_description(12345) == "Desconocido"
