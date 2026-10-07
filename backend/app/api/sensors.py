from fastapi import APIRouter, HTTPException
from typing import List
from app.core import state
from app.models.schemas import SensorReading, SystemStatus, SensorIngest
from datetime import datetime
from app.core import state

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

@router.post("/gateway/heartbeat")
async def gateway_heartbeat():
    """El Gateway loRaWAN llama esto periodicamente para confirmar que esta vivo."""
    state.last_gateway_heartbeat = datetime.utcnow()
    return {"status": "ok", "received_at": state.last_gateway_heartbeat}



@router.post("/ingest")
async def ingest_sensor(payload: SensorIngest):
    """Recibe lecturas reales del nodo ESP32 (Wokwi o hardware físico)."""
    zone_id = payload.sensor_id.removeprefix("sensor_")
    if zone_id not in {z["id"] for z in state.ZONES}:
        raise HTTPException(status_code=404, detail=f"sensor_id '{payload.sensor_id}' no registrado")
    reading = state.ingest_real_reading(zone_id, payload.humidity, payload.temperature)
    state.last_gateway_heartbeat = datetime.utcnow()  # PROVISORIO hasta HU-21
    return {
        "status": "ok",
        "sensor_id": reading.sensor_id,
        "humidity": reading.humidity,
        "temperature": reading.temperature,
        "received_at": reading.timestamp,
    }