"""
Validación de rango e integridad de lecturas reales del ESP32 (HU-22).
Una lectura inválida se descarta: se registra en el log y NO se guarda en la base de datos.
"""
import logging
import math
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("terraflow.validation")


def check_reading(sensor_id: str, humidity: float, temperature: float) -> Optional[str]:
    """
    Devuelve None si la lectura es válida, o el motivo del descarte (y lo deja en el log).
    """
    reason = None

    if not math.isfinite(humidity) or not math.isfinite(temperature):
        reason = f"valor no numérico (humedad={humidity}, temperatura={temperature})"
    elif not (settings.SENSOR_HUMIDITY_MIN <= humidity <= settings.SENSOR_HUMIDITY_MAX):
        reason = (
            f"humedad {humidity}% fuera de rango "
            f"[{settings.SENSOR_HUMIDITY_MIN}, {settings.SENSOR_HUMIDITY_MAX}]"
        )
    elif not (settings.SENSOR_TEMP_MIN <= temperature <= settings.SENSOR_TEMP_MAX):
        reason = (
            f"temperatura {temperature}°C fuera de rango "
            f"[{settings.SENSOR_TEMP_MIN}, {settings.SENSOR_TEMP_MAX}]"
        )

    if reason:
        logger.warning("LECTURA DESCARTADA [%s]: %s", sensor_id, reason)
    return reason