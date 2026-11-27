"""
Ventana horaria de riego automático.

Un productor consultado recomendó regar solo de noche o de madrugada (20:00 a 08:00)
para reducir la evaporación. Esta ventana se evalúa en la zona horaria del predio y
solo afecta al modo AUTOMÁTICO: una orden manual desde el dashboard es una decisión
explícita de la persona y no se bloquea.
"""
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.core.config import settings


def parse_hhmm(value: str) -> time:
    try:
        hour, minute = value.split(":")
        return time(int(hour), int(minute))
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Hora inválida '{value}': usa el formato HH:MM") from exc


def is_within_window(now: time, start: time, end: time) -> bool:
    """True si 'now' cae dentro de [start, end). Soporta ventanas que cruzan la medianoche."""
    if start == end:
        return True  # ventana de 24 h
    if start < end:
        return start <= now < end
    return now >= start or now < end


def get_schedule() -> dict:
    return {
        "enabled": settings.IRRIGATION_WINDOW_ENABLED,
        "start": settings.IRRIGATION_WINDOW_START,
        "end": settings.IRRIGATION_WINDOW_END,
        "timezone": settings.TIMEZONE,
    }


def set_schedule(enabled: bool, start: str, end: str) -> dict:
    parse_hhmm(start)
    parse_hhmm(end)
    settings.IRRIGATION_WINDOW_ENABLED = enabled
    settings.IRRIGATION_WINDOW_START = start
    settings.IRRIGATION_WINDOW_END = end
    return get_schedule()


def _now_local() -> datetime:
    return datetime.now(ZoneInfo(settings.TIMEZONE))


def is_irrigation_allowed_now() -> bool:
    """El riego automático está permitido ahora (o la ventana está desactivada)."""
    if not settings.IRRIGATION_WINDOW_ENABLED:
        return True
    return is_within_window(
        _now_local().time(),
        parse_hhmm(settings.IRRIGATION_WINDOW_START),
        parse_hhmm(settings.IRRIGATION_WINDOW_END),
    )
