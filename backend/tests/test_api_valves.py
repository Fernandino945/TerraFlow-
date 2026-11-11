from app.core import state
from app.models.schemas import AlertLevel


def test_list_valves(client):
    response = client.get("/api/valves/")
    assert response.status_code == 200
    assert len(response.json()) == 4


def test_manual_open_changes_mode(client):
    response = client.post(
        "/api/valves/command",
        json={"valve_id": "zone_1", "action": "open", "reason": "prueba"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "open"
    assert state.valve_states["zone_1"].auto_mode is False
    assert state.active_alerts[0].level == AlertLevel.INFO


def test_unknown_valve_returns_not_found(client):
    response = client.post(
        "/api/valves/command", json={"valve_id": "zone_99", "action": "open"}
    )
    assert response.status_code == 404


def test_invalid_action_returns_validation_error(client):
    response = client.post(
        "/api/valves/command", json={"valve_id": "zone_1", "action": "abrir"}
    )
    assert response.status_code == 422


def test_auto_mode_can_be_restored(client):
    state.valve_states["zone_1"].auto_mode = False
    response = client.post("/api/valves/zone_1/auto", params={"auto": "true"})
    assert response.status_code == 200
    assert state.valve_states["zone_1"].auto_mode is True
