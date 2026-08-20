"""
Capa de persistencia con MongoDB (driver async: motor).
Guarda historial de sensores, estado de válvulas, alertas, umbrales y configuración de ubicación.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import Optional
from app.core.config import settings

client: Optional[AsyncIOMotorClient] = None
db = None


def connect():
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[settings.MONGO_DB_NAME]


def close():
    global client
    if client:
        client.close()


# ---------- Colecciones ----------
def sensor_history_collection():
    return db["sensor_history"]

def valve_states_collection():
    return db["valve_states"]

def thresholds_collection():
    return db["thresholds"]

def alerts_collection():
    return db["alerts"]

def user_location_collection():
    return db["user_location"]

def system_events_collection():
    return db["system_events"]  # watchdog / failsafe / caídas


# ---------- Sensores: historial ----------
async def save_sensor_reading(reading: dict):
    await sensor_history_collection().insert_one(reading)

async def get_sensor_history(zone_id: Optional[str] = None, limit: int = 100):
    query = {"sensor_id": f"sensor_{zone_id}"} if zone_id else {}
    cursor = sensor_history_collection().find(query).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    docs.reverse()
    return docs

async def prune_old_readings(older_than_days: int = 30):
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)
    await sensor_history_collection().delete_many({"timestamp": {"$lt": cutoff}})


# ---------- Válvulas ----------
async def save_valve_state(valve: dict):
    await valve_states_collection().update_one(
        {"valve_id": valve["valve_id"]}, {"$set": valve}, upsert=True
    )

async def get_all_valve_states():
    cursor = valve_states_collection().find({})
    return await cursor.to_list(length=100)

async def get_valve_state(valve_id: str):
    return await valve_states_collection().find_one({"valve_id": valve_id})


# ---------- Umbrales ----------
async def save_threshold(threshold: dict):
    await thresholds_collection().update_one(
        {"zone_id": threshold["zone_id"]}, {"$set": threshold}, upsert=True
    )

async def get_threshold(zone_id: str):
    return await thresholds_collection().find_one({"zone_id": zone_id})

async def get_all_thresholds():
    cursor = thresholds_collection().find({})
    return await cursor.to_list(length=100)


# ---------- Alertas ----------
async def save_alert(alert: dict):
    await alerts_collection().insert_one(alert)

async def get_alerts(limit: int = 20):
    cursor = alerts_collection().find({}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)

async def acknowledge_alert(alert_id: str):
    await alerts_collection().update_one(
        {"alert_id": alert_id}, {"$set": {"acknowledged": True}}
    )


# ---------- Ubicación del usuario ----------
async def save_user_location(location: dict):
    """Guarda/actualiza la ubicación para el pronóstico (un único documento 'activo')."""
    await user_location_collection().update_one(
        {"_id": "active_location"}, {"$set": {**location, "_id": "active_location"}}, upsert=True
    )

async def get_user_location():
    return await user_location_collection().find_one({"_id": "active_location"})


# ---------- Eventos del sistema (caídas, failsafe, watchdog) ----------
async def log_system_event(event_type: str, detail: str):
    await system_events_collection().insert_one({
        "event_type": event_type,
        "detail": detail,
        "timestamp": datetime.utcnow(),
    })

async def get_system_events(limit: int = 50):
    cursor = system_events_collection().find({}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)


# ---------- Explorador genérico (visor visual de la base de datos) ----------
KNOWN_COLLECTIONS = [
    "sensor_history", "valve_states", "thresholds",
    "alerts", "user_location", "system_events",
]

async def list_collections_with_counts():
    """Devuelve cada colección conocida junto a su cantidad de documentos."""
    result = []
    for name in KNOWN_COLLECTIONS:
        count = await db[name].count_documents({})
        result.append({"name": name, "count": count})
    return result

async def get_collection_documents(name: str, page: int = 1, page_size: int = 20):
    """
    Pagina los documentos de una colección, ordenados por el campo más reciente
    disponible (timestamp / last_changed) si existe, o por _id si no.
    """
    if name not in KNOWN_COLLECTIONS:
        return {"documents": [], "total": 0}

    collection = db[name]
    total = await collection.count_documents({})

    sort_field = "timestamp"
    sample = await collection.find_one({})
    if sample and "timestamp" not in sample:
        sort_field = "last_changed" if "last_changed" in (sample or {}) else "_id"

    skip = (page - 1) * page_size
    cursor = collection.find({}).sort(sort_field, -1).skip(skip).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    # _id puede ser ObjectId o string; lo normalizamos a string para JSON
    for d in docs:
        d["_id"] = str(d["_id"])

    return {"documents": docs, "total": total, "page": page, "page_size": page_size}
