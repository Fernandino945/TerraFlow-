"""
Escala simple de humedad objetivo (1 a 5) para configurar umbrales sin números.

Surgió de la evaluación con un productor: "establecer los parámetros desde el dashboard de forma
simple, de ligeramente seco a muy húmedo". Cada nivel se traduce a los cuatro umbrales que ya usa el
motor de riego. El riego automático se enciende bajo 'warning_low' y se apaga sobre 'warning_high'.

Son valores de referencia, NO una recomendación agronómica por cultivo: el nivel 3 coincide con los
umbrales por defecto y el ajuste fino sigue disponible en la edición manual y en los perfiles fenológicos.
"""
from typing import Optional

MOISTURE_LEVELS = {
    1: {"label": "Ligeramente seco", "critical_low": 10, "warning_low": 20, "warning_high": 45, "critical_high": 55},
    2: {"label": "Seco moderado", "critical_low": 18, "warning_low": 28, "warning_high": 60, "critical_high": 70},
    3: {"label": "Equilibrado", "critical_low": 25, "warning_low": 35, "warning_high": 75, "critical_high": 85},
    4: {"label": "Húmedo", "critical_low": 35, "warning_low": 45, "warning_high": 82, "critical_high": 90},
    5: {"label": "Muy húmedo", "critical_low": 45, "warning_low": 55, "warning_high": 88, "critical_high": 95},
}

_KEYS = ("critical_low", "warning_low", "warning_high", "critical_high")


def level_values(level: int) -> dict:
    return {key: MOISTURE_LEVELS[level][key] for key in _KEYS}


def detect_level(th) -> Optional[int]:
    """Nivel 1-5 cuyos umbrales coinciden exactamente con los de la zona; None si son personalizados."""
    for level, values in MOISTURE_LEVELS.items():
        if all(float(getattr(th, key)) == float(values[key]) for key in _KEYS):
            return level
    return None
