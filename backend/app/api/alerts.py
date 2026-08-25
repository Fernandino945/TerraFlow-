from fastapi import APIRouter
from typing import List
from app.core import state, database as db
from app.models.schemas import Alert, HumidityThresholds

router = APIRouter()

@router.get("/", response_model=List[Alert])
async def get_alerts(limit: int = 20):
    return state.active_alerts[:limit]

@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    for alert in state.active_alerts:
        if alert.alert_id == alert_id:
            alert.acknowledged = True
            await db.acknowledge_alert(alert_id)
            return {"message": "Alerta confirmada"}
    return {"message": "Alerta no encontrada"}

@router.get("/thresholds", response_model=List[HumidityThresholds])
async def get_thresholds():
    return list(state.thresholds.values())

@router.put("/thresholds/{zone_id}", response_model=HumidityThresholds)
async def update_thresholds(zone_id: str, thresholds: HumidityThresholds):
    state.thresholds[zone_id] = thresholds
    state.persist_threshold(thresholds)
    return thresholds

@router.get("/system-events")
async def get_system_events(limit: int = 50):
    """
    Historial de eventos técnicos: activaciones de failsafe, caídas detectadas
    por el watchdog. Permite auditar la mitigación de riesgo técnico del sistema.
    """
    events = await db.get_system_events(limit=limit)
    for e in events:
        e.pop("_id", None)
    return events
