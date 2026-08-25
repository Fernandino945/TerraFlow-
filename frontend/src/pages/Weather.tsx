import React, { useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { fetchWeather, refreshWeather, WeatherSummary } from '../services/api'
import { WeatherPanel } from '../components/dashboard/WeatherPanel'
import { PrecipitationChart } from '../components/charts/PrecipitationChart'
import { Thermometer, Wind, CloudRain, RefreshCw } from 'lucide-react'

export const Weather: React.FC = () => {
  const weatherFetcher = useCallback(() => fetchWeather(), [])
  const { data: weather, loading, refetch } = usePolling<WeatherSummary>(weatherFetcher, 60000)

  const handleRefresh = async () => {
    try { await refreshWeather() } catch {}
    refetch()
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Pronóstico Climático
        </h1>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: '#1e2a18', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {loading && !weather ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : weather ? (
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
          {/* Left: main weather panel */}
          <WeatherPanel weather={weather} onRefresh={refetch} />

          {/* Right: details */}
          <div className="flex flex-col gap-6">
            {/* 24h stats grid */}
            <div className="grid grid-cols-3 gap-4">
              <MeteoCard
                icon={<Thermometer size={18} style={{ color: '#f59e0b' }} />}
                label="Temp. mín (12h)"
                value={`${Math.min(...weather.hourly_forecast.slice(0, 12).map(f => f.temperature_2m)).toFixed(1)}°C`}
                color="#f59e0b"
              />
              <MeteoCard
                icon={<CloudRain size={18} style={{ color: '#38bdf8' }} />}
                label="Lluvia acum. (12h)"
                value={`${weather.hourly_forecast.slice(0, 12).reduce((s, f) => s + f.precipitation, 0).toFixed(1)} mm`}
                color="#38bdf8"
              />
              <MeteoCard
                icon={<Wind size={18} style={{ color: '#a78bfa' }} />}
                label="Viento máx (12h)"
                value={`${Math.max(...weather.hourly_forecast.slice(0, 12).map(f => f.windspeed_10m)).toFixed(0)} km/h`}
                color="#a78bfa"
              />
            </div>

            {/* Precipitation chart */}
            <PrecipitationChart forecast={weather.hourly_forecast} />

            {/* 24h temperature table */}
            <div className="card p-5">
              <div className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
                Detalle Horario (24h)
              </div>
              <div className="overflow-auto max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-left pb-2 mono">Hora</th>
                      <th className="text-right pb-2">Temp.</th>
                      <th className="text-right pb-2">Lluvia</th>
                      <th className="text-right pb-2">Prob.</th>
                      <th className="text-right pb-2">Viento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weather.hourly_forecast.slice(0, 24).map((f, i) => {
                      const hour = new Date(f.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      const isFrost = f.temperature_2m < 8
                      const isRainy = f.precipitation > 2
                      return (
                        <tr
                          key={i}
                          style={{
                            borderTop: '1px solid var(--border)',
                            background: isFrost ? 'rgba(167,139,250,0.05)' : isRainy ? 'rgba(56,189,248,0.05)' : 'transparent',
                          }}
                        >
                          <td className="py-1.5 mono" style={{ color: 'var(--text-muted)' }}>{hour}</td>
                          <td className="text-right mono" style={{ color: isFrost ? '#a78bfa' : '#f59e0b' }}>
                            {f.temperature_2m.toFixed(1)}°C
                          </td>
                          <td className="text-right mono" style={{ color: isRainy ? '#38bdf8' : 'var(--text-muted)' }}>
                            {f.precipitation.toFixed(1)} mm
                          </td>
                          <td className="text-right mono" style={{ color: f.precipitation_probability > 60 ? '#38bdf8' : 'var(--text-muted)' }}>
                            {f.precipitation_probability.toFixed(0)}%
                          </td>
                          <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>
                            {f.windspeed_10m.toFixed(0)} km/h
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const MeteoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({
  icon, label, value, color
}) => (
  <div className="card p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <div className="mono text-xl font-bold" style={{ color }}>{value}</div>
  </div>
)
