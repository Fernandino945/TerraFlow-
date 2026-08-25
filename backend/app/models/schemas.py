from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ValveStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    ERROR = "error"

class TrafficLightStatus(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"

class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class SensorReading(BaseModel):
    sensor_id: str
    zone_name: str
    humidity: float = Field(..., ge=0, le=100, description="Humedad del suelo (%)")
    temperature: float = Field(..., description="Temperatura ambiente (°C)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: TrafficLightStatus = TrafficLightStatus.GREEN

class ValveState(BaseModel):
    valve_id: str
    zone_name: str
    status: ValveStatus = ValveStatus.CLOSED
    last_changed: datetime = Field(default_factory=datetime.utcnow)
    auto_mode: bool = True

class ValveCommand(BaseModel):
    valve_id: str
    action: str = Field(..., pattern="^(open|close)$")
    reason: Optional[str] = "manual"

class WeatherForecast(BaseModel):
    timestamp: datetime
    temperature_2m: float
    precipitation: float
    precipitation_probability: float
    windspeed_10m: float
    weathercode: int

class WeatherSummary(BaseModel):
    current_temp: float
    current_humidity: Optional[float]
    hourly_forecast: List[WeatherForecast]
    will_rain: bool
    frost_risk: bool
    saturation_risk: bool
    irrigation_suspended: bool
    suspension_reason: Optional[str]

class Alert(BaseModel):
    alert_id: str
    level: AlertLevel
    message: str
    zone: Optional[str]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    acknowledged: bool = False

class SystemStatus(BaseModel):
    overall: TrafficLightStatus
    zones: List[SensorReading]
    valves: List[ValveState]
    alerts: List[Alert]
    irrigation_suspended: bool
    suspension_reason: Optional[str]
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class HumidityThresholds(BaseModel):
    zone_id: str
    zone_name: str
    crop_type: str
    critical_low: float = 25.0
    warning_low: float = 35.0
    warning_high: float = 75.0
    critical_high: float = 85.0

class MonthlyReport(BaseModel):
    month: str
    total_irrigation_hours: float
    estimated_water_liters: float
    savings_vs_traditional_pct: float
    avg_humidity: float
    alerts_count: int
    zones_data: dict
