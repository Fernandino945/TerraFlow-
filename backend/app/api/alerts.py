from fastapi import APIRouter, HTTPException
from typing import List
from app.core import state, database as db
from app.core.phenology_profiles import PHENOLOGY_PROFILES
from app.core.moisture_levels import MOISTURE_LEVELS, detect_level, level_values
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

def _with_level(th: HumidityThresholds) -> HumidityThresholds:
    th.moisture_level = detect_level(th)
    return th


@router.get("/thresholds", response_model=List[HumidityThresholds])
async def get_thresholds():
    return [_with_level(th) for th in state.thresholds.values()]


@router.get("/moisture-levels")
async def get_moisture_levels():
    """Escala 1-5 de humedad objetivo y los umbrales que equivale cada nivel."""
    return [{"level": level, **values} for level, values in MOISTURE_LEVELS.items()]


@router.post("/thresholds/{zone_id}/moisture-level", response_model=HumidityThresholds)
async def apply_moisture_level(zone_id: str, level: int):
    if level not in MOISTURE_LEVELS:
        raise HTTPException(422, "El nivel debe estar entre 1 y 5")
    current = state.thresholds.get(zone_id)
    if not current:
        raise HTTPException(404, "Zona no encontrada")
    thresholds = HumidityThresholds(
        zone_id=zone_id,
        zone_name=current.zone_name,
        crop_type=current.crop_type,
        phenological_phase=None,
        **level_values(level),
    )
    state.thresholds[zone_id] = thresholds
    state.persist_threshold(thresholds)
    return _with_level(thresholds)

@router.put("/thresholds/{zone_id}", response_model=HumidityThresholds)
async def update_thresholds(zone_id: str, thresholds: HumidityThresholds):
    state.thresholds[zone_id] = thresholds
    state.persist_threshold(thresholds)
    return _with_level(thresholds)

@router.get("/phenology-profiles")
async def get_phenology_profiles():
    return PHENOLOGY_PROFILES

@router.post("/thresholds/{zone_id}/apply-profile", response_model=HumidityThresholds)
async def apply_phenology(zone_id: str, crop_type: str, phase: str):
    profile = PHENOLOGY_PROFILES.get(crop_type, {}).get(phase)
    if not profile:
        raise HTTPException(404, "Perfil no encontrado para ese cultivo/fase")
    if zone_id not in state.thresholds:
        raise HTTPException(404, "Zona no encontrada")
    thresholds = HumidityThresholds(
        zone_id=zone_id,
        zone_name=state.thresholds[zone_id].zone_name,
        crop_type=crop_type,
        phenological_phase=phase,
        **profile,
    )
    state.thresholds[zone_id] = thresholds
    state.persist_threshold(thresholds)
    return _with_level(thresholds)

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
