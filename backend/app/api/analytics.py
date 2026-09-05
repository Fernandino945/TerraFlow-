from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
import random
from app.core import state, database as db
from app.core.phenology_profiles import PHENOLOGY_PROFILES
from app.models.schemas import BrixReading

router = APIRouter()

OPTIMAL_HOURS_PER_DAY = {
    "brotacion": 3.5, "floracion": 3.0, "envero": 1.8, "maduracion": 1.2,
}

# Rango de Brix esperado para categoría Premium, por fase (referencia agronómica a validar con el profesor guía)
BRIX_PREMIUM_RANGE = {
    "envero": (14, 18), "maduracion": (22, 26),
}

@router.post("/brix-reading")
async def submit_brix_reading(reading: BrixReading):
    """Carga manual de grados Brix medidos con refractómetro (no automatizable)."""
    if reading.zone_id not in state.thresholds:
        raise HTTPException(404, "Zona no encontrada")
    await db.save_brix_reading(reading.model_dump(exclude={"timestamp"}))
    return {"message": "Lectura Brix registrada"}


@router.get("/water-efficiency")
async def get_water_efficiency(period: str = Query("week", pattern="^(week|month)$")):
    days = 7 if period == "week" else 30
    zones_analysis = []

    for zone_id, th in state.thresholds.items():
        phase = th.phenological_phase or "maduracion"
        optimal_daily = OPTIMAL_HOURS_PER_DAY.get(phase, 2.0)
        optimal_total = round(optimal_daily * days, 1)

        # TODO: reemplazar por horas reales acumuladas desde historial de válvulas en Mongo
        actual_total = round(optimal_total * random.uniform(0.75, 1.35), 1)
        eua = round(min(actual_total, optimal_total) / max(actual_total, optimal_total) * 100, 1)

        reading = state.sensor_readings.get(zone_id)
        humidity = reading.humidity if reading else 50

        # Proxy automático por estrés hídrico
        profile = PHENOLOGY_PROFILES.get(th.crop_type, {}).get(phase)
        quality_source = "estres_hidrico"
        if profile and profile["warning_low"] <= humidity <= profile["warning_high"]:
            quality = "green"
        else:
            quality = "yellow"

        # Si hay lectura Brix manual reciente (<7 días), prevalece sobre el proxy
        brix_doc = await db.get_latest_brix(zone_id)
        brix_value = None
        if brix_doc and (datetime.utcnow() - brix_doc["timestamp"]) < timedelta(days=7):
            brix_value = brix_doc["brix_value"]
            low, high = BRIX_PREMIUM_RANGE.get(phase, (0, 100))
            quality = "green" if low <= brix_value <= high else "yellow"
            quality_source = "brix_manual"

        zones_analysis.append({
            "zone_id": zone_id,
            "zone_name": th.zone_name,
            "crop_type": th.crop_type,
            "phenological_phase": phase,
            "actual_hours": actual_total,
            "optimal_hours": optimal_total,
            "water_use_efficiency": eua,
            "quality_status": quality,
            "quality_source": quality_source,
            "brix_value": brix_value,
        })

    return {"period": period, "zones": zones_analysis}