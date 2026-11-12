from datetime import datetime, timedelta

from app.core import database as db, state
from app.core.config import settings


def test_monthly_report_calculates_water_from_irrigation_events(client, monkeypatch):
    start = datetime(2026, 11, 1)
    end = start + timedelta(hours=2)
    state.sensor_readings["zone_1"] = state.generate_sensor_reading(
        "zone_1", "Sector Norte - Maíz"
    )
    events = [
        {"valve_id": "zone_1", "event_type": "open", "timestamp": start},
        {"valve_id": "zone_1", "event_type": "closed", "timestamp": start + timedelta(minutes=30)},
    ]
    monkeypatch.setattr(db, "get_irrigation_events", lambda *_: _events(events))
    monkeypatch.setattr(settings, "CALIBRATED_FLOW_LPM", 8.0)
    monkeypatch.setattr(settings, "TRADITIONAL_FLOW_LPM", 16.0)

    response = client.get(
        "/api/reports/monthly",
        params={"start": start.isoformat(), "end": end.isoformat()},
    )

    assert response.status_code == 200
    report = response.json()
    assert report["used_water_liters"] == 240.0
    assert report["traditional_reference_liters"] == 480.0
    assert report["savings_vs_traditional_pct"] == 50.0
    assert report["total_irrigation_hours"] == 0.5


async def _events(events):
    return events


def test_monthly_report_rejects_invalid_period(client):
    response = client.get(
        "/api/reports/monthly",
        params={"start": "2026-11-02T00:00:00", "end": "2026-11-01T00:00:00"},
    )
    assert response.status_code == 400
