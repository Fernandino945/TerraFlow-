from fastapi import APIRouter, HTTPException
from app.services import weather_service, irrigation_logic
from app.models.schemas import WeatherSummary

router = APIRouter()

@router.get("/forecast", response_model=WeatherSummary)
async def get_weather_forecast():
    """Obtiene pronóstico climático y evalúa suspensión de riego."""
    try:
        summary = await weather_service.get_forecast()
        # Actualizar lógica de riego basada en clima
        irrigation_logic.set_weather_context(
            suspended=summary.irrigation_suspended,
            reason=summary.suspension_reason or "",
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error obteniendo pronóstico: {str(e)}")

@router.post("/refresh")
async def refresh_weather():
    """Fuerza actualización del caché climático."""
    try:
        await weather_service.refresh_cache()
        return {"message": "Pronóstico actualizado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
