from datetime import datetime, timedelta

from app.core import state
from app.core.config import settings
from app.models.schemas import AlertLevel, ValveStatus
from app.services import watchdog


def test_expired_gateway_heartbeat_closes_open_valves():
    for valve in state.valve_states.values():
        valve.status = ValveStatus.OPEN
    state.last_gateway_heartbeat = datetime.utcnow() - timedelta(
        seconds=settings.WATCHDOG_TIMEOUT_SECONDS + 1
    )
    watchdog.check_watchdog()
    assert all(valve.status == ValveStatus.CLOSED for valve in state.valve_states.values())
    assert state.irrigation_suspended is True
    assert state.active_alerts[0].level == AlertLevel.CRITICAL


def test_recent_gateway_heartbeat_does_not_activate_failsafe():
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    state.last_gateway_heartbeat = datetime.utcnow()
    watchdog.check_watchdog()
    assert state.valve_states["zone_1"].status == ValveStatus.OPEN
    assert not state.active_alerts


def test_failsafe_recovers_after_gateway_heartbeat():
    state.valve_states["zone_1"].status = ValveStatus.OPEN
    state.last_gateway_heartbeat = datetime.utcnow() - timedelta(
        seconds=settings.WATCHDOG_TIMEOUT_SECONDS + 1
    )
    watchdog.check_watchdog()
    state.last_gateway_heartbeat = datetime.utcnow()
    watchdog.check_watchdog()
    assert state.irrigation_suspended is False
    assert state.suspension_reason == ""
