"""
Motor de decisión de riego: lazo cerrado.
Evalúa sensores + clima y actúa sobre válvulas automáticamente.
Cada cambio de estado de válvula se persiste en MongoDB (state.persist_valve)
para no perder el estado ante una caída del backend.
"""
from datetime import datetime
from app.core import state
from app.models.schemas import ValveStatus, AlertLevel, TrafficLightStatus

_last_weather: dict = {}


def set_weather_context(suspended: bool, reason: str = ""):
    global _last_weather
    _last_weather = {"suspended": suspended, "reason": reason}
    if state.suspension_reason and state.suspension_reason.startswith("FAILSAFE"):
        return


    state.irrigation_suspended = suspended
    state.suspension_reason = reason

    if suspended and reason:
        state.add_alert(AlertLevel.WARNING, f"Riego suspendido: {reason}")


def _close_valve(valve, reason_msg: str = None, level: AlertLevel = None, zone: str = None):
    valve.status = ValveStatus.CLOSED
    valve.last_changed = datetime.utcnow()
    state.persist_valve(valve)
    if reason_msg:
        state.add_alert(level or AlertLevel.INFO, reason_msg, zone=zone)


def _open_valve(valve, reason_msg: str = None, level: AlertLevel = None, zone: str = None):
    valve.status = ValveStatus.OPEN
    valve.last_changed = datetime.utcnow()
    state.persist_valve(valve)
    if reason_msg:
        state.add_alert(level or AlertLevel.INFO, reason_msg, zone=zone)


def evaluate_auto_irrigation():
    """Evalúa el estado de cada zona y controla válvulas en modo automático."""
    for zone_id, reading in state.sensor_readings.items():
        valve = state.valve_states.get(zone_id)
        if not valve or not valve.auto_mode:
            continue

        th = state.thresholds.get(zone_id)
        if not th:
            continue

        # Si el riego está suspendido globalmente (clima), cerrar válvulas
        if state.irrigation_suspended:
            if valve.status == ValveStatus.OPEN:
                _close_valve(valve)
            continue

        # Lógica de lazo cerrado por humedad
        if reading.humidity < th.critical_low:
            if valve.status != ValveStatus.OPEN:
                _open_valve(
                    valve,
                    f"Humedad crítica ({reading.humidity}%) — riego activado automáticamente",
                    AlertLevel.CRITICAL,
                    zone=reading.zone_name,
                )
        elif reading.humidity < th.warning_low:
            if valve.status != ValveStatus.OPEN:
                _open_valve(
                    valve,
                    f"Humedad baja ({reading.humidity}%) — riego iniciado",
                    AlertLevel.WARNING,
                    zone=reading.zone_name,
                )
        elif reading.humidity > th.critical_high:
            if valve.status != ValveStatus.CLOSED:
                _close_valve(
                    valve,
                    f"Humedad crítica alta ({reading.humidity}%) — riego detenido",
                    AlertLevel.CRITICAL,
                    zone=reading.zone_name,
                )
        elif reading.humidity > th.warning_high:
            if valve.status != ValveStatus.CLOSED:
                _close_valve(valve)
        # En zona verde no se hace nada
