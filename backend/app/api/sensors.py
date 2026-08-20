from fastapi import APIRouter
from typing import List
from app.core import state
from app.models.schemas import SensorReading, SystemStatus

router = APIRouter()

@router.get("/", response_model=List[SensorReading])
async def get_all_sensors():
    """Retorna lecturas actuales de todos los sensores."""
    return list(state.sensor_readings.values())

@router.get("/status", response_model=SystemStatus)
async def get_system_status():
    """Estado general del sistema (semáforo + válvulas + alertas)."""
    return SystemStatus(
        overall=state.get_overall_status(),
        zones=list(state.sensor_readings.values()),
        valves=list(state.valve_states.values()),
        alerts=state.active_alerts[:10],
        irrigation_suspended=state.irrigation_suspended,
        suspension_reason=state.suspension_reason if state.suspension_reason else None,
    )

@router.get("/history", response_model=List[SensorReading])
async def get_sensor_history(zone_id: str = None, limit: int = 100):
    """Historial de lecturas por zona."""
    history = state.reading_history
    if zone_id:
        history = [r for r in history if r.sensor_id == f"sensor_{zone_id}"]
    return history[-limit:]
