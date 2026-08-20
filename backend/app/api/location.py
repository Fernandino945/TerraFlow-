from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.core import database as db
from app.core.config import settings
from app.services import weather_service

router = APIRouter()


class UserLocation(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_name: str = "Mi predio"


@router.get("/", response_model=UserLocation)
async def get_location():
    """Obtiene la ubicación actualmente configurada para el pronóstico."""
    saved = await db.get_user_location()
    if saved:
        saved.pop("_id", None)
        return UserLocation(**saved)
    return UserLocation(
        latitude=settings.LATITUDE,
        longitude=settings.LONGITUDE,
        location_name=settings.LOCATION_NAME,
    )


@router.put("/", response_model=UserLocation)
async def set_location(location: UserLocation):
    """
    Permite al usuario especificar la ubicación de su predio.
    El pronóstico climático (Open-Meteo) se recalcula para esa zona exacta.
    """
    await db.save_user_location(location.model_dump())

    # Aplicar inmediatamente a la config en memoria usada por el servicio de clima
    settings.LATITUDE = location.latitude
    settings.LONGITUDE = location.longitude
    settings.LOCATION_NAME = location.location_name

    # Forzar refresco del pronóstico con la nueva ubicación
    await weather_service.refresh_cache()

    return location
