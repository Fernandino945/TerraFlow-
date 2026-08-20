from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import sensors, valves, weather, reports, alerts, location, database as database_api
from app.core.config import settings
from app.core.scheduler import start_scheduler
from app.core import database as db, state

app = FastAPI(
    title="TerraFlow API",
    description="Plataforma IoT de lazo cerrado para automatización de riego agrícola",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensors.router, prefix="/api/sensors", tags=["Sensores"])
app.include_router(valves.router, prefix="/api/valves", tags=["Válvulas"])
app.include_router(weather.router, prefix="/api/weather", tags=["Clima"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reportes"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alertas"])
app.include_router(location.router, prefix="/api/location", tags=["Ubicación"])
app.include_router(database_api.router, prefix="/api/database", tags=["Base de Datos"])

@app.on_event("startup")
async def startup_event():
    db.connect()
    await state.load_state_from_db()

    # Restaurar ubicación del usuario si fue configurada previamente
    saved_location = await db.get_user_location()
    if saved_location:
        settings.LATITUDE = saved_location["latitude"]
        settings.LONGITUDE = saved_location["longitude"]
        settings.LOCATION_NAME = saved_location["location_name"]

    start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    db.close()

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "TerraFlow API"}
