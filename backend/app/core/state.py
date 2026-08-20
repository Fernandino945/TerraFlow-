"""
State store híbrido para TerraFlow:
- Caché en memoria para respuestas instantáneas del dashboard.
- Persistencia real en MongoDB (historial, válvulas, alertas, umbrales).
Esto resuelve el riesgo técnico de pérdida de datos ante una caída del backend:
al reiniciar, el estado se recupera desde MongoDB en vez de partir de cero.
"""
import random
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List
from app.models.schemas import (
    SensorReading, ValveState, ValveStatus, Alert, AlertLevel,
    TrafficLightStatus, HumidityThresholds
)
from app.core import database as db
from app.core.config import settings

# Zonas del predio
ZONES = [
    {"id": "zone_1", "name": "Sector Norte - Maíz"},
    {"id": "zone_2", "name": "Sector Sur - Trigo"},
    {"id": "zone_3", "name": "Sector Este - Viña"},
    {"id": "zone_4", "name": "Sector Oeste - Hortalizas"},
]

# Estado de sensores (caché en memoria)
sensor_readings: Dict[str, SensorReading] = {}

# Estado de válvulas (caché en memoria)
valve_states: Dict[str, ValveState] = {
    z["id"]: ValveState(valve_id=z["id"], zone_name=z["name"])
    for z in ZONES
}

# Umbrales por zona (caché en memoria)
thresholds: Dict[str, HumidityThresholds] = {
    z["id"]: HumidityThresholds(
        zone_id=z["id"],
        zone_name=z["name"],
        crop_type="General",
    )
    for z in ZONES
}

# Alertas activas (caché en memoria, espejo de Mongo)
active_alerts: List[Alert] = []

# Historial de lecturas (caché corto en memoria; el historial completo vive en Mongo)
reading_history: List[SensorReading] = []

# Estado de suspensión de riego
irrigation_suspended: bool = False
suspension_reason: str = ""

# Último heartbeat del scheduler — usado por el watchdog para detectar caídas
last_heartbeat: datetime = datetime.utcnow()


def generate_sensor_reading(zone_id: str, zone_name: str) -> SensorReading:
    """Simula lectura de sensor IoT."""
    base_humidity = 55.0
    base_temp = 18.0

    humidity = max(10, min(95, base_humidity + random.gauss(0, 12)))
    temperature = base_temp + random.gauss(0, 3)

    th = thresholds.get(zone_id)
    if th:
        if humidity <= th.critical_low or humidity >= th.critical_high:
            status = TrafficLightStatus.RED
        elif humidity <= th.warning_low or humidity >= th.warning_high:
            status = TrafficLightStatus.YELLOW
        else:
            status = TrafficLightStatus.GREEN
    else:
        status = TrafficLightStatus.GREEN

    return SensorReading(
        sensor_id=f"sensor_{zone_id}",
        zone_name=zone_name,
        humidity=round(humidity, 1),
        temperature=round(temperature, 1),
        timestamp=datetime.utcnow(),
        status=status,
    )


_pending_tasks: List = []


def _safe_create_task(coro):
    """
    Crea una task async para persistir en Mongo. Se registra en _pending_tasks
    para que el caller (scheduler) pueda esperar a que termine antes de continuar,
    evitando que se descarten silenciosamente si no hay loop corriendo.
    """
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(coro)
        _pending_tasks.append(task)
        task.add_done_callback(lambda t: _pending_tasks.remove(t) if t in _pending_tasks else None)
    except RuntimeError:
        coro.close()  # no hay loop corriendo (p.ej. import inicial) — se descarta sin warning


async def wait_pending_writes():
    """Espera a que todas las escrituras a Mongo en curso terminen."""
    if _pending_tasks:
        await asyncio.gather(*_pending_tasks, return_exceptions=True)


def refresh_all_sensors():
    """Refresca todas las lecturas de sensores (caché) y dispara guardado async en Mongo."""
    global sensor_readings, last_heartbeat
    last_heartbeat = datetime.utcnow()

    for z in ZONES:
        reading = generate_sensor_reading(z["id"], z["name"])
        sensor_readings[z["id"]] = reading
        reading_history.append(reading)
        _safe_create_task(db.save_sensor_reading(reading.model_dump()))

    if len(reading_history) > 1440 * len(ZONES):
        del reading_history[:len(ZONES)]


def get_overall_status() -> TrafficLightStatus:
    statuses = [r.status for r in sensor_readings.values()]
    if TrafficLightStatus.RED in statuses:
        return TrafficLightStatus.RED
    if TrafficLightStatus.YELLOW in statuses:
        return TrafficLightStatus.YELLOW
    return TrafficLightStatus.GREEN


def add_alert(level: AlertLevel, message: str, zone: str = None):
    alert = Alert(
        alert_id=str(uuid.uuid4())[:8],
        level=level,
        message=message,
        zone=zone,
    )
    active_alerts.insert(0, alert)
    if len(active_alerts) > 50:
        active_alerts.pop()
    _safe_create_task(db.save_alert(alert.model_dump()))


def persist_valve(valve: ValveState):
    """Guarda el estado de una válvula en Mongo (llamar tras cualquier cambio)."""
    _safe_create_task(db.save_valve_state(valve.model_dump()))


def persist_threshold(th: HumidityThresholds):
    _safe_create_task(db.save_threshold(th.model_dump()))


async def load_state_from_db():
    """
    Recupera el estado desde MongoDB al arrancar el backend.
    Esto es lo que mitiga el riesgo técnico de perder configuración tras una caída:
    válvulas, umbrales y alertas recientes se restauran en vez de partir de cero.
    """
    # Válvulas
    saved_valves = await db.get_all_valve_states()
    for v in saved_valves:
        v.pop("_id", None)
        valve_states[v["valve_id"]] = ValveState(**v)

    # Umbrales
    saved_thresholds = await db.get_all_thresholds()
    for t in saved_thresholds:
        t.pop("_id", None)
        thresholds[t["zone_id"]] = HumidityThresholds(**t)

    # Alertas recientes
    saved_alerts = await db.get_alerts(limit=50)
    for a in saved_alerts:
        a.pop("_id", None)
        active_alerts.append(Alert(**a))

    # Historial reciente (para que el gráfico no arranque vacío)
    for z in ZONES:
        recent = await db.get_sensor_history(zone_id=z["id"], limit=60)
        for r in recent:
            r.pop("_id", None)
            reading_history.append(SensorReading(**r))


# Inicializar caché con datos frescos (antes de que cargue Mongo, para no bloquear el arranque)
refresh_all_sensors()

