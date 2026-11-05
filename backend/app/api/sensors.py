from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core import database as db
from app.core import state
from app.core.config import settings
from app.models.schemas import AlertLevel, SensorReading, SystemStatus, SensorIngest, GatewayHeartbeat
from app.services import sensor_validation

router = APIRouter()

# HU-23: diagnóstico por zona del último contacto del nodo ESP32 (se llena en /ingest).
# Vive en memoria; la última lectura real se recupera de Mongo si el backend se reinicia.
_node_diag: Dict[str, dict] = {}


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
    """Historial de lecturas reales por zona."""
    history = [reading for reading in state.reading_history if reading.source == "esp32"]
    if zone_id:
        history = [r for r in history if r.sensor_id == f"sensor_{zone_id}"]
    return history[-limit:]

@router.post("/gateway/heartbeat")
async def gateway_heartbeat(payload: Optional[GatewayHeartbeat] = None):
    """Recibe el heartbeat WiFi del ESP32 o del Gateway LoRaWAN futuro."""
    state.last_gateway_heartbeat = datetime.utcnow()
    origin = payload.sensor_id if payload and payload.sensor_id else "gateway"
    if payload and origin.startswith("sensor_"):
        zone_id = origin.removeprefix("sensor_")
        diag = _node_diag.setdefault(zone_id, {"discarded_total": 0})
        diag.update(
            last_contact=state.last_gateway_heartbeat,
            rssi=payload.rssi,
            uptime_s=payload.uptime_s,
            failsafe_active=payload.failsafe_active,
            failure_count=payload.failure_count,
            failure_reason=payload.failure_reason,
        )
    if payload and payload.failsafe_active:
        state.add_alert(
            AlertLevel.WARNING,
            f"Failsafe local reportado por {origin}: "
            f"{payload.failure_reason or 'fallos de comunicación'} "
            f"({payload.failure_count} fallos).",
            zone=origin.removeprefix("sensor_"),
        )
    return {
        "status": "ok",
        "source": origin,
        "failsafe_active": payload.failsafe_active if payload else False,
        "failure_count": payload.failure_count if payload else 0,
        "received_at": state.last_gateway_heartbeat,
    }


@router.post("/ingest")
async def ingest_sensor(payload: SensorIngest):
    """Recibe lecturas reales del nodo ESP32 (Wokwi o hardware físico)."""
    zone_id = payload.sensor_id.removeprefix("sensor_")
    if zone_id not in {z["id"] for z in state.ZONES}:
        raise HTTPException(status_code=404, detail=f"sensor_id '{payload.sensor_id}' no registrado")

    now = datetime.utcnow()

    # HU-23: registrar el contacto del nodo para el diagnóstico
    diag = _node_diag.setdefault(zone_id, {"discarded_total": 0})
    diag.update(last_contact=now, rssi=payload.rssi, uptime_s=payload.uptime_s, raw_adc=payload.raw_adc)

    # HU-22: validar rango e integridad ANTES de guardar nada
    reason = sensor_validation.check_reading(payload.sensor_id, payload.humidity, payload.temperature)
    if reason:
        diag["discarded_total"] += 1
        diag["last_discard_reason"] = reason
        diag["last_discard_at"] = now
        raise HTTPException(status_code=422, detail={"status": "discarded", "reason": reason})

    reading = state.ingest_real_reading(zone_id, payload.humidity, payload.temperature)
    return {
        "status": "ok",
        "sensor_id": reading.sensor_id,
        "humidity": reading.humidity,
        "temperature": reading.temperature,
        "received_at": reading.timestamp,
    }


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _iso(dt: Optional[datetime]) -> Optional[str]:
    """ISO 8601 en UTC con 'Z' para que el navegador lo convierta bien a hora local."""
    return _naive_utc(dt).isoformat() + "Z" if dt else None


async def _last_real_reading(zone_id: str, sensor_id: str) -> Optional[dict]:
    """Última lectura enviada por el ESP32 (caché en memoria o, si no, Mongo)."""
    candidates = []
    cached = state.sensor_readings.get(zone_id)
    if cached and cached.source == "esp32":
        candidates.append({
            "humidity": cached.humidity,
            "temperature": cached.temperature,
            "timestamp": _naive_utc(cached.timestamp),
            "status": getattr(cached.status, "value", cached.status),
        })
    try:
        doc = await db.sensor_history_collection().find_one(
            {"sensor_id": sensor_id, "source": "esp32"}, sort=[("timestamp", -1)]
        )
        if doc:
            candidates.append({
                "humidity": doc["humidity"],
                "temperature": doc["temperature"],
                "timestamp": _naive_utc(doc["timestamp"]),
                "status": doc.get("status"),
            })
    except Exception:
        pass  # sin Mongo: nos quedamos con la caché
    return max(candidates, key=lambda r: r["timestamp"], default=None)


@router.get("/node-status")
async def get_node_status():
    """
    HU-23: diagnóstico de conexión de cada nodo ESP32.
    node_status: "online" (reportó dentro del umbral), "no_report" (superó el umbral
    de heartbeat) o "never" (la zona no tiene nodo real: la alimenta el simulador).
    """
    now = datetime.utcnow()
    threshold = settings.WATCHDOG_TIMEOUT_SECONDS
    nodes = []

    for z in state.ZONES:
        zone_id = z["id"]
        sensor_id = f"sensor_{zone_id}"
        diag = _node_diag.get(zone_id, {})
        last_reading = await _last_real_reading(zone_id, sensor_id)

        seen = [t for t in (diag.get("last_contact"), last_reading and last_reading["timestamp"]) if t]
        last_seen = max(seen) if seen else None

        if last_seen is None:
            node_status, seconds_since = "never", None
        else:
            seconds_since = max(0, int((now - last_seen).total_seconds()))
            node_status = "online" if seconds_since <= threshold else "no_report"

        current = state.sensor_readings.get(zone_id)
        nodes.append({
            "zone_id": zone_id,
            "zone_name": z["name"],
            "sensor_id": sensor_id,
            "node_status": node_status,
            "threshold_seconds": threshold,
            "last_seen": _iso(last_seen),
            "seconds_since": seconds_since,
            "last_reading": last_reading and {**last_reading, "timestamp": _iso(last_reading["timestamp"])},
            "current_source": current.source if current else None,
            "rssi": diag.get("rssi"),
            "uptime_s": diag.get("uptime_s"),
            "raw_adc": diag.get("raw_adc"),
            "discarded_total": diag.get("discarded_total", 0),
            "last_discard_reason": diag.get("last_discard_reason"),
            "last_discard_at": _iso(diag.get("last_discard_at")),
            "failsafe_active": diag.get("failsafe_active", False),
            "failure_count": diag.get("failure_count", 0),
            "failure_reason": diag.get("failure_reason"),
        })
    return nodes