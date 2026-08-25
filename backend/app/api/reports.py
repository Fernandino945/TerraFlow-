from fastapi import APIRouter
from datetime import datetime
import random
from app.models.schemas import MonthlyReport
from app.core import state

router = APIRouter()

@router.get("/monthly", response_model=MonthlyReport)
async def get_monthly_report():
    """Genera reporte mensual de consumo hídrico."""
    # En producción: consultar base de datos histórica
    open_valves = sum(1 for v in state.valve_states.values() if v.status.value == "open")
    
    zones_data = {}
    for zone_id, reading in state.sensor_readings.items():
        zones_data[zone_id] = {
            "zone_name": reading.zone_name,
            "avg_humidity": reading.humidity,
            "irrigation_hours": round(random.uniform(12, 48), 1),
        }

    return MonthlyReport(
        month=datetime.now().strftime("%B %Y"),
        total_irrigation_hours=round(sum(z["irrigation_hours"] for z in zones_data.values()), 1),
        estimated_water_liters=round(random.uniform(8000, 25000), 0),
        savings_vs_traditional_pct=round(random.uniform(22, 38), 1),
        avg_humidity=round(sum(r.humidity for r in state.sensor_readings.values()) / max(1, len(state.sensor_readings)), 1),
        alerts_count=len(state.active_alerts),
        zones_data=zones_data,
    )
