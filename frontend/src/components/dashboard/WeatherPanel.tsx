import React from 'react'
import { Cloud, CloudRain, Snowflake, Wind, Thermometer, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { WeatherSummary, WeatherForecast, refreshWeather } from '../../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  weather: WeatherSummary
  onRefresh: () => void
}

const weatherIcons: Record<number, React.ReactNode> = {
  0: <span>☀️</span>, 1: <span>🌤️</span>, 2: <span>⛅</span>, 3: <span>☁️</span>,
  45: <span>🌫️</span>, 48: <span>🌫️</span>,
  51: <span>🌦️</span>, 53: <span>🌦️</span>, 55: <span>🌧️</span>,
  61: <span>🌧️</span>, 63: <span>🌧️</span>, 65: <span>🌧️</span>,
  71: <span>🌨️</span>, 73: <span>🌨️</span>, 75: <span>❄️</span>,
  80: <span>🌦️</span>, 81: <span>🌧️</span>, 82: <span>⛈️</span>,
  95: <span>⛈️</span>, 96: <span>⛈️</span>, 99: <span>⛈️</span>,
}

const getWeatherIcon = (code: number) => weatherIcons[code] || <Cloud size={16} />

export const WeatherPanel: React.FC<Props> = ({ weather, onRefresh }) => {
  const handleRefresh = async () => {
    try {
      await refreshWeather()
      onRefresh()
    } catch {}
  }

  return (
    <div className="card p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Pronóstico Climático
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-lg transition-colors hover:bg-green-900"
          style={{ color: 'var(--text-muted)' }}
          title="Actualizar pronóstico"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Current temp */}
      <div className="flex items-center gap-3">
        <div className="text-4xl">{getWeatherIcon(weather.hourly_forecast[0]?.weathercode ?? 0)}</div>
        <div>
          <div className="text-3xl font-bold mono" style={{ color: 'var(--text-primary)' }}>
            {weather.current_temp.toFixed(1)}°C
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Temperatura actual</div>
        </div>
      </div>

      {/* Risk indicators */}
      <div className="grid grid-cols-3 gap-2">
        <RiskBadge active={weather.will_rain} icon={<CloudRain size={12} />} label="Lluvia" />
        <RiskBadge active={weather.frost_risk} icon={<Snowflake size={12} />} label="Helada" />
        <RiskBadge active={weather.saturation_risk} icon={<Wind size={12} />} label="Saturación" />
      </div>

      {/* Suspension banner */}
      {weather.irrigation_suspended ? (
        <div
          className="flex items-start gap-2 p-3 rounded-lg"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#fbbf24' }} />
          <div>
            <div className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
              Riego suspendido
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {weather.suspension_reason}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 p-3 rounded-lg"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <CheckCircle size={14} style={{ color: '#4ade80' }} />
          <span className="text-xs" style={{ color: '#4ade80' }}>Condiciones aptas para riego</span>
        </div>
      )}

      {/* 12h Hourly forecast strip */}
      <div>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Próximas 12 horas</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weather.hourly_forecast.slice(0, 12).map((f, i) => (
            <HourlyCard key={i} forecast={f} />
          ))}
        </div>
      </div>
    </div>
  )
}

const RiskBadge: React.FC<{ active: boolean; icon: React.ReactNode; label: string }> = ({ active, icon, label }) => (
  <div
    className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg"
    style={{
      background: active ? 'rgba(251,191,36,0.12)' : '#1e2a18',
      border: `1px solid ${active ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`,
    }}
  >
    <span style={{ color: active ? '#fbbf24' : 'var(--text-muted)' }}>{icon}</span>
    <span className="text-xs" style={{ color: active ? '#fbbf24' : 'var(--text-muted)' }}>{label}</span>
    <div
      className="w-1.5 h-1.5 rounded-full"
      style={{ backgroundColor: active ? '#fbbf24' : '#2a3823' }}
    />
  </div>
)

const HourlyCard: React.FC<{ forecast: WeatherForecast }> = ({ forecast }) => {
  const hour = format(new Date(forecast.timestamp), 'HH:mm')
  return (
    <div
      className="flex flex-col items-center gap-1.5 shrink-0 p-2 rounded-lg"
      style={{ background: '#1e2a18', minWidth: 52 }}
    >
      <div className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{hour}</div>
      <div className="text-base">{getWeatherIcon(forecast.weathercode)}</div>
      <div className="mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
        {forecast.temperature_2m.toFixed(0)}°
      </div>
      {forecast.precipitation > 0 && (
        <div className="mono text-xs" style={{ color: '#38bdf8' }}>
          {forecast.precipitation.toFixed(1)}mm
        </div>
      )}
    </div>
  )
}
