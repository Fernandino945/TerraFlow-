from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import MonthlyReport
from app.core import state, database as db
from app.core.config import settings

router = APIRouter()


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


@router.get("/monthly", response_model=MonthlyReport)
async def get_monthly_report(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
):
    """Genera el reporte hídrico para un periodo, usando eventos de riego."""
    now = datetime.utcnow()
    period_end = _utc_naive(end) if end else now
    period_start = _utc_naive(start) if start else period_end.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    if period_start >= period_end:
        raise HTTPException(status_code=400, detail="El inicio del periodo debe ser anterior al fin")

    events = await db.get_irrigation_events(period_start, period_end)
    open_events = {}
    irrigation_minutes = {}
    for event in events:
        key = event["valve_id"]
        if event["event_type"] == "open":
            open_events[key] = event["timestamp"]
        elif event["event_type"] == "closed" and key in open_events:
            duration = (
                _utc_naive(event["timestamp"]) - _utc_naive(open_events.pop(key))
            ).total_seconds() / 60
            irrigation_minutes[key] = irrigation_minutes.get(key, 0) + max(0, duration)

    # Un riego aún abierto se contabiliza hasta el final del periodo.
    for key, opened_at in open_events.items():
        irrigation_minutes[key] = irrigation_minutes.get(key, 0) + max(
            0, (period_end - _utc_naive(opened_at)).total_seconds() / 60
        )

    zones_data = {}
    for zone_id, reading in state.sensor_readings.items():
        minutes = irrigation_minutes.get(zone_id, 0)
        zones_data[zone_id] = {
            "zone_name": reading.zone_name,
            "avg_humidity": reading.humidity,
            "irrigation_hours": round(minutes / 60, 1),
        }

    total_hours = sum(irrigation_minutes.values()) / 60
    used_liters = total_hours * 60 * settings.CALIBRATED_FLOW_LPM
    traditional_liters = total_hours * 60 * settings.TRADITIONAL_FLOW_LPM
    savings = ((traditional_liters - used_liters) / traditional_liters * 100) if traditional_liters else 0
    return MonthlyReport(
        month=period_end.strftime("%B %Y"),
        total_irrigation_hours=round(total_hours, 1),
        estimated_water_liters=round(used_liters, 1),
        used_water_liters=round(used_liters, 1),
        traditional_reference_liters=round(traditional_liters, 1),
        savings_vs_traditional_pct=round(savings, 1),
        period_start=period_start,
        period_end=period_end,
        calibrated_flow_lpm=settings.CALIBRATED_FLOW_LPM,
        avg_humidity=round(sum(r.humidity for r in state.sensor_readings.values()) / max(1, len(state.sensor_readings)), 1),
        alerts_count=len(state.active_alerts),
        zones_data=zones_data,
    )
