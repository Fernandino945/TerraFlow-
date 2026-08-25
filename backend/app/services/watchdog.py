"""
Watchdog de mitigación de riesgo técnico.

Resuelve el problema discutido: si el motor de evaluación (scheduler) deja de
responder, las válvulas NO deben quedar congeladas en el último estado.

Lógica "normally-closed": si no hay heartbeat reciente del scheduler,
se asume que el sistema de decisión está caído y se fuerza el cierre de
todas las válvulas como estado seguro por defecto.
"""
from datetime import datetime
from app.core import state, database as db
from app.core.config import settings
from app.models.schemas import ValveStatus, AlertLevel


def check_watchdog():
    """Se ejecuta periódicamente. Si el heartbeat está vencido, aplica failsafe."""
    elapsed = (datetime.utcnow() - state.last_gateway_heartbeat).total_seconds()

    if elapsed > settings.WATCHDOG_TIMEOUT_SECONDS:
        _trigger_failsafe(elapsed)
    elif state.suspension_reason and state.suspension_reason.startswith("FAILSAFE"):
        state.irrigation_suspended = False
        state.suspension_reason = "None"
        state.add_alert(AlertLevel.INFO, "Heartbeat del Gateway restablecido. Failsafe desactivado.")


def _trigger_failsafe(elapsed_seconds: float):
    """Cierra todas las válvulas y registra el evento — estado seguro ante caída."""
    closed_any = False
    for valve in state.valve_states.values():
        if valve.status != ValveStatus.CLOSED and settings.FAILSAFE_VALVE_STATE == "closed":
            valve.status = ValveStatus.CLOSED
            valve.last_changed = datetime.utcnow()
            state.persist_valve(valve)
            closed_any = True

    if closed_any:
        state.irrigation_suspended = True
        state.suspension_reason = f"FAILSAFE: sin heartbeat del Gateway por {elapsed_seconds:.0f}s"
        state.add_alert(
            AlertLevel.CRITICAL,
            f"FAILSAFE activado: sin heartbeat por {elapsed_seconds:.0f}s. "
            f"Todas las válvulas cerradas por seguridad.",
        )
        state._safe_create_task(db.log_system_event(
            "failsafe_triggered",
            f"Watchdog detectó {elapsed_seconds:.0f}s sin heartbeat. Válvulas forzadas a CERRADO."
        ))
