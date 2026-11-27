from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.core import database as db
from app.services import irrigation_schedule

router = APIRouter()

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class ScheduleUpdate(BaseModel):
    enabled: bool
    start: str = Field(..., pattern=HHMM, description="Inicio de la ventana, HH:MM")
    end: str = Field(..., pattern=HHMM, description="Fin de la ventana, HH:MM")


def _response() -> dict:
    return {**irrigation_schedule.get_schedule(), "allowed_now": irrigation_schedule.is_irrigation_allowed_now()}


@router.get("/schedule")
async def get_schedule():
    """Ventana horaria de riego automático y si el riego está permitido en este momento."""
    return _response()


@router.put("/schedule")
async def update_schedule(payload: ScheduleUpdate):
    irrigation_schedule.set_schedule(payload.enabled, payload.start, payload.end)
    await db.save_irrigation_schedule(irrigation_schedule.get_schedule())
    return _response()
