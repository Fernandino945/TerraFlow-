import React, { useCallback } from 'react'
import { TrafficLightBig } from '../components/dashboard/TrafficLight'
import { ZoneCard } from '../components/dashboard/ZoneCard'
import { WeatherPanel } from '../components/dashboard/WeatherPanel'
import { AlertsPanel } from '../components/alerts/AlertsPanel'
import { HumidityChart } from '../components/charts/HumidityChart'
import { usePolling } from '../hooks/usePolling'
import {
  fetchSystemStatus, fetchWeather, fetchAlerts, fetchSensorHistory,
  commandValve, setValveAutoMode, SystemStatus, WeatherSummary, Alert
} from '../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

export const Dashboard: React.FC = () => {
  const statusFetcher = useCallback(() => fetchSystemStatus(), [])
  const weatherFetcher = useCallback(() => fetchWeather(), [])
  const alertsFetcher = useCallback(() => fetchAlerts(), [])
  const historyFetcher = useCallback(() => fetchSensorHistory('zone_1', 60), [])

  const { data: status, loading: statusLoading, error: statusError, refetch: refetchStatus } = usePolling<SystemStatus>(statusFetcher, 10000)
  const { data: weather, loading: weatherLoading, refetch: refetchWeather } = usePolling<WeatherSummary>(weatherFetcher, 60000)
  const { data: alerts, refetch: refetchAlerts } = usePolling<Alert[]>(alertsFetcher, 15000)
  const { data: history } = usePolling(historyFetcher, 30000)

  const handleToggleValve = async (valve_id: string, action: 'open' | 'close') => {
    try {
      await commandValve(valve_id, action, 'Intervención manual desde dashboard')
      refetchStatus()
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleAuto = async (valve_id: string, auto: boolean) => {
    try {
      await setValveAutoMode(valve_id, auto)
      refetchStatus()
    } catch (e) {
      console.error(e)
    }
  }

  const now = format(new Date(), "EEEE d 'de' MMMM, HH:mm", { locale: es })

  return (
    <div className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-deep)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Panel de Control
          </h1>
          <div className="mono text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
            {now}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusError ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#ef4444' }}>
              <WifiOff size={14} />
              <span>Sin conexión — mostrando último estado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4ade80' }}>
              <Wifi size={14} />
              <span>Conectado</span>
            </div>
          )}
          <button
            onClick={() => { refetchStatus(); refetchAlerts() }}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#1e2a18', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={14} className={statusLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {statusLoading && !status ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="animate-spin mx-auto mb-3" />
            Conectando con sensores...
          </div>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {/* Semáforo global */}
          <div className="card flex items-center justify-center">
            {status && <TrafficLightBig status={status.overall} />}
          </div>

          {/* Summary stats */}
          <div className="col-span-2 grid grid-cols-3 gap-4">
            <StatCard
              label="Zonas activas"
              value={status?.valves.filter(v => v.status === 'open').length ?? 0}
              suffix={`/ ${status?.valves.length ?? 0}`}
              color="#4ade80"
            />
            <StatCard
              label="Alertas activas"
              value={alerts?.filter(a => !a.acknowledged).length ?? 0}
              color={alerts?.some(a => !a.acknowledged && a.level === 'critical') ? '#ef4444' : '#fbbf24'}
            />
            <StatCard
              label="Temp. actual"
              value={weather?.current_temp?.toFixed(1) ?? '--'}
              suffix="°C"
              color="#f59e0b"
            />
          </div>

          {/* Zone cards */}
          {status?.zones.map(zone => {
            const valve = status.valves.find(v => v.valve_id === zone.sensor_id.replace('sensor_', ''))
            return (
              <ZoneCard
                key={zone.sensor_id}
                sensor={zone}
                valve={valve}
                onToggleValve={handleToggleValve}
                onToggleAuto={handleToggleAuto}
              />
            )
          })}

          {/* Humidity history chart */}
          {history && (
            <div className="col-span-2">
              <HumidityChart history={history} zoneName="Sector Norte - Maíz" />
            </div>
          )}

          {/* Weather + Alerts */}
          <div className="flex flex-col gap-4">
            {weather && <WeatherPanel weather={weather} onRefresh={refetchWeather} />}
            {alerts && <AlertsPanel alerts={alerts} onRefresh={refetchAlerts} />}
          </div>

          {/* Suspension banner */}
          {status?.irrigation_suspended && (
            <div
              className="col-span-3 flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.4)' }}
            >
              <div
                className="w-2 h-2 rounded-full status-pulse-yellow"
                style={{ background: '#fbbf24' }}
              />
              <span className="font-medium text-sm" style={{ color: '#fbbf24' }}>
                Riego suspendido automáticamente:
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {status.suspension_reason}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const StatCard: React.FC<{ label: string; value: string | number; suffix?: string; color: string }> = ({
  label, value, suffix, color
}) => (
  <div className="card p-4 flex flex-col gap-1">
    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div className="flex items-baseline gap-1">
      <span className="mono text-2xl font-bold" style={{ color }}>{value}</span>
      {suffix && <span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
    </div>
  </div>
)
