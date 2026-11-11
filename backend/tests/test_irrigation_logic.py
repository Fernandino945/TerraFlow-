from app.core import state
from app.models.schemas import AlertLevel, SensorReading, ValveStatus
from app.services import irrigation_logic


def put_reading(humidity, temperature=20.0, zone="zone_1"):
    name = next(item["name"] for item in state.ZONES if item["id"] == zone)
    state.sensor_readings[zone] = SensorReading(
        sensor_id=f"sensor_{zone}", zone_name=name, humidity=humidity, temperature=temperature
    )


def test_critical_dryness_opens_valve_and_alerts():
    put_reading(20)
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.OPEN
    assert state.active_alerts[0].level == AlertLevel.CRITICAL


def test_normal_humidity_does_not_open_valve():
    put_reading(50)
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED
    assert not state.active_alerts


def test_high_humidity_closes_valve():
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    put_reading(90)
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED
    assert state.active_alerts[0].level == AlertLevel.CRITICAL


def test_manual_valve_is_not_changed_by_automatic_mode():
    state.valve_states["zone_1"].auto_mode = False
    put_reading(20)
    irrigation_logic.evaluate_auto_irrigation()
    assert state.valve_states["zone_1"].status == ValveStatus.CLOSED
