from datetime import datetime

from app.core import state
from app.models.schemas import SensorReading, TrafficLightStatus


def test_real_reading_has_expected_status():
    assert state.ingest_real_reading("zone_1", 20, 15).status == TrafficLightStatus.RED
    assert state.ingest_real_reading("zone_1", 50, 15).status == TrafficLightStatus.GREEN


def test_real_node_prevents_simulator_overwrite():
    state.real_last_seen["zone_1"] = datetime.utcnow()
    state.refresh_all_sensors()
    assert "zone_1" not in state.sensor_readings


def reading(status):
    return SensorReading(
        sensor_id="sensor_zone_1", zone_name="Z", humidity=50, temperature=20, status=status
    )


def test_overall_status_prioritizes_red():
    state.sensor_readings["zone_1"] = reading(TrafficLightStatus.GREEN)
    state.sensor_readings["zone_2"] = reading(TrafficLightStatus.RED)
    assert state.get_overall_status() == TrafficLightStatus.RED
