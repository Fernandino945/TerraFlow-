from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core import database as db, state
from app.core.config import settings
from app.main import app
from app.models.schemas import HumidityThresholds, ValveState

TEST_KEY = "clave-de-prueba"


async def _noop(*args, **kwargs):
    return None


@pytest.fixture(autouse=True)
def entorno_aislado(monkeypatch):
    for name in (
        "save_sensor_reading",
        "save_valve_state",
        "save_alert",
        "save_threshold",
        "log_system_event",
    ):
        monkeypatch.setattr(db, name, _noop)
    monkeypatch.setattr(settings, "NODE_API_KEY", TEST_KEY, raising=False)
    state.sensor_readings.clear()
    state.reading_history.clear()
    state.active_alerts.clear()
    state.real_last_seen.clear()
    state.irrigation_suspended = False
    state.suspension_reason = ""
    state.last_gateway_heartbeat = datetime.utcnow()
    for zone in state.ZONES:
        state.valve_states[zone["id"]] = ValveState(valve_id=zone["id"], zone_name=zone["name"])
        state.thresholds[zone["id"]] = HumidityThresholds(
            zone_id=zone["id"], zone_name=zone["name"], crop_type="General"
        )
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def headers():
    return {"X-API-Key": TEST_KEY}
