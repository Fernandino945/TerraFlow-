from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest

from app.core import database as db, state
from app.core.config import settings
from app.core.moisture_levels import MOISTURE_LEVELS, detect_level
from app.models.schemas import SensorReading, ValveStatus
from app.services import irrigation_logic, irrigation_schedule


@pytest.fixture(autouse=True)
def ventana_restaurada(monkeypatch):
    monkeypatch.setattr(settings, "IRRIGATION_WINDOW_ENABLED", False)
    monkeypatch.setattr(settings, "IRRIGATION_WINDOW_START", "20:00")
    monkeypatch.setattr(settings, "IRRIGATION_WINDOW_END", "08:00")
    irrigation_logic._window_alerted.clear()


def fake_now(monkeypatch, hour, minute=0):
    local = datetime(2026, 11, 27, hour, minute, tzinfo=ZoneInfo("America/Santiago"))
    monkeypatch.setattr(irrigation_schedule, "_now_local", lambda: local)


def put_dry_reading(humidity=20):
    state.sensor_readings["zone_1"] = SensorReading(
        sensor_id="sensor_zone_1", zone_name="Zona 1", humidity=humidity, temperature=20.0
    )


@pytest.mark.parametrize("hour,expected", [(19, False), (20, True), (23, True), (0, True), (7, True), (8, False), (12, False)])
def test_ventana_nocturna_cruza_medianoche(hour, expected):
    assert irrigation_schedule.is_within_window(time(hour, 0), time(20, 0), time(8, 0)) is expected


def test_ventana_diurna_normal():
    assert irrigation_schedule.is_within_window(time(10, 0), time(8, 0), time(18, 0))
    assert not irrigation_schedule.is_within_window(time(18, 0), time(8, 0), time(18, 0))


def test_ventana_desactivada_permite_siempre(monkeypatch):
    fake_now(monkeypatch, 13)
    assert irrigation_schedule.is_irrigation_allowed_now()


def test_auto_no_abre_fuera_de_horario(monkeypatch):
    irrigation_schedule.set_schedule(True, "20:00", "08:00")
    fake_now(monkeypatch, 13)
    put_dry_reading()
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED
    assert any("fuera del horario" in a.message for a in state.active_alerts)


def test_alerta_fuera_de_horario_no_se_repite(monkeypatch):
    irrigation_schedule.set_schedule(True, "20:00", "08:00")
    fake_now(monkeypatch, 13)
    put_dry_reading()
    irrigation_logic.evaluate_auto_irrigation()
    irrigation_logic.evaluate_auto_irrigation()
    assert len(state.active_alerts) == 1


def test_auto_abre_dentro_de_horario(monkeypatch):
    irrigation_schedule.set_schedule(True, "20:00", "08:00")
    fake_now(monkeypatch, 22)
    put_dry_reading()
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.OPEN


def test_al_terminar_la_ventana_cierra_valvula_automatica(monkeypatch):
    irrigation_schedule.set_schedule(True, "20:00", "08:00")
    fake_now(monkeypatch, 9)
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    put_dry_reading(50)
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED


def test_valvula_manual_no_se_cierra_por_horario(monkeypatch):
    irrigation_schedule.set_schedule(True, "20:00", "08:00")
    fake_now(monkeypatch, 13)
    valve = state.valve_states["zone_1"]
    valve.auto_mode = False
    valve.status = ValveStatus.OPEN
    put_dry_reading()
    irrigation_logic.evaluate_auto_irrigation()
    assert valve.status == ValveStatus.OPEN


def test_api_schedule_get_y_put(client, monkeypatch):
    saved = {}

    async def fake_save(schedule):
        saved.update(schedule)

    monkeypatch.setattr(db, "save_irrigation_schedule", fake_save)
    fake_now(monkeypatch, 22)
    r = client.put("/api/irrigation/schedule", json={"enabled": True, "start": "20:00", "end": "08:00"})
    assert r.status_code == 200
    assert r.json()["allowed_now"] is True
    assert saved["enabled"] is True
    assert client.get("/api/irrigation/schedule").json()["start"] == "20:00"


def test_api_schedule_rechaza_hora_invalida(client):
    r = client.put("/api/irrigation/schedule", json={"enabled": True, "start": "25:00", "end": "08:00"})
    assert r.status_code == 422


def test_escala_de_humedad_es_monotona_y_valida():
    levels = [MOISTURE_LEVELS[n] for n in range(1, 6)]
    for a, b in zip(levels, levels[1:]):
        assert a["warning_low"] < b["warning_low"]
        assert a["warning_high"] < b["warning_high"]
    for v in levels:
        assert v["critical_low"] < v["warning_low"] < v["warning_high"] < v["critical_high"] <= 100


def test_api_aplica_nivel_de_humedad(client):
    r = client.post("/api/alerts/thresholds/zone_1/moisture-level", params={"level": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["moisture_level"] == 4
    assert body["warning_low"] == 45
    assert state.thresholds["zone_1"].warning_low == 45
    assert detect_level(state.thresholds["zone_1"]) == 4


def test_api_nivel_fuera_de_rango(client):
    assert client.post("/api/alerts/thresholds/zone_1/moisture-level", params={"level": 6}).status_code == 422
    assert client.post("/api/alerts/thresholds/zona_x/moisture-level", params={"level": 3}).status_code == 404


def test_umbrales_por_defecto_son_nivel_3(client):
    zone = next(t for t in client.get("/api/alerts/thresholds").json() if t["zone_id"] == "zone_1")
    assert zone["moisture_level"] == 3
