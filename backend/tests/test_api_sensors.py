from datetime import datetime, timedelta

from app.core import state
from app.models.schemas import AlertLevel, ValveStatus

INGEST = "/api/sensors/ingest"
HEARTBEAT = "/api/sensors/gateway/heartbeat"
READING = {"sensor_id": "sensor_zone_1", "humidity": 45.0, "temperature": 21.5}


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_node_endpoints_require_api_key(client):
    assert client.post(INGEST, json=READING).status_code == 401
    assert client.post(HEARTBEAT, json={}).status_code == 401


def test_ingest_valid_reading(client, headers):
    response = client.post(INGEST, json=READING, headers=headers)
    assert response.status_code == 200
    assert state.sensor_readings["zone_1"].humidity == 45.0
    assert "zone_1" in state.real_last_seen


def test_ingest_rejects_invalid_reading_without_saving(client, headers):
    response = client.post(INGEST, json={**READING, "humidity": 150}, headers=headers)
    assert response.status_code == 422
    assert response.json()["detail"]["status"] == "discarded"
    assert "zone_1" not in state.sensor_readings


def test_ingest_does_not_update_gateway_heartbeat(client, headers):
    previous = datetime.utcnow() - timedelta(seconds=300)
    state.last_gateway_heartbeat = previous
    client.post(INGEST, json=READING, headers=headers)
    assert state.last_gateway_heartbeat == previous


def test_heartbeat_returns_desired_status_for_its_zone(client, headers):
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    state.valve_states["zone_1"].desired_status = ValveStatus.OPEN
    response = client.post(HEARTBEAT, json={"sensor_id": "sensor_zone_1"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["desired_status"] == "open"


def test_heartbeat_updates_actual_valve_state_from_node(client, headers):
    valve = state.valve_states["zone_1"]
    valve.status = ValveStatus.OPEN
    valve.desired_status = ValveStatus.OPEN

    response = client.post(
        HEARTBEAT,
        json={"sensor_id": "sensor_zone_1", "actual_status": "open"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["desired_status"] == "open"
    assert state.valve_states["zone_1"].actual_status == ValveStatus.OPEN
    status = client.get("/api/sensors/status").json()
    zone_valve = next(item for item in status["valves"] if item["valve_id"] == "zone_1")
    assert zone_valve["actual_status"] == "open"


def test_heartbeat_closes_valve_when_node_reports_local_failsafe(client, headers):
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    state.valve_states["zone_1"].desired_status = ValveStatus.OPEN
    response = client.post(
        HEARTBEAT,
        json={
            "sensor_id": "sensor_zone_1",
            "failsafe_active": True,
            "failure_count": 3,
            "failure_reason": "fallo de heartbeat",
            "actual_status": "closed",
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["desired_status"] == "closed"
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED
    assert state.active_alerts[0].level == AlertLevel.WARNING


def test_failsafe_is_alerted_once_and_does_not_fake_valve_feedback(client, headers):
    valve = state.valve_states["zone_1"]
    valve.status = ValveStatus.CLOSED
    valve.desired_status = ValveStatus.CLOSED
    valve.actual_status = ValveStatus.OPEN
    payload = {
        "sensor_id": "sensor_zone_1",
        "failsafe_active": True,
        "failure_count": 3,
        "failure_reason": "fallo de heartbeat",
        "actual_status": "open",
    }

    first = client.post(HEARTBEAT, json=payload, headers=headers)
    second = client.post(HEARTBEAT, json=payload, headers=headers)

    assert first.json()["desired_status"] == "closed"
    assert second.json()["desired_status"] == "closed"
    assert state.valve_states["zone_1"].desired_status == ValveStatus.CLOSED
    assert state.valve_states["zone_1"].actual_status == ValveStatus.OPEN
    assert len(state.active_alerts) == 1
    assert state.active_alerts[0].level == AlertLevel.WARNING


def test_node_status_responds(client):
    response = client.get("/api/sensors/node-status")
    assert response.status_code == 200
