from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1"
    LATITUDE: float = -33.45  # Santiago, Chile por defecto
    LONGITUDE: float = -70.66
    LOCATION_NAME: str = "Predio Principal"

    # Umbrales por defecto
    HUMIDITY_CRITICAL_LOW: float = 25.0
    HUMIDITY_CRITICAL_HIGH: float = 85.0
    HUMIDITY_WARNING_LOW: float = 35.0
    HUMIDITY_WARNING_HIGH: float = 75.0
    FROST_TEMP_THRESHOLD: float = 8.0
    SOIL_FROST_TEMP_THRESHOLD: float = 1.5 
    RAIN_SUSPENSION_THRESHOLD: float = 5.0  # mm

    # Simulador de sensores
    SIMULATE_SENSORS: bool = True

    # MongoDB
    MONGO_URI: str = "mongodb://mongo:27017"
    MONGO_DB_NAME: str = "terraflow"

    # Watchdog / mitigación de riesgo técnico
    WATCHDOG_TIMEOUT_SECONDS: int = 90  # si no hay heartbeat en este lapso, failsafe cierra válvulas
    FAILSAFE_VALVE_STATE: str = "closed"  # estado seguro ante caída: "closed" (normally-closed)

    class Config:
        env_file = ".env"

settings = Settings()
