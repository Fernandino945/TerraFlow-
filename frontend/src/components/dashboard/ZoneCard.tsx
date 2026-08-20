import React from 'react'
import { Droplets, Thermometer, Wifi, WifiOff } from 'lucide-react'
import { SensorReading, ValveState } from '../../services/api'
import { TrafficLight } from './TrafficLight'

interface Props {
  sensor: SensorReading
  valve?: ValveState
  onToggleValve: (valve_id: string, action: 'open' | 'close') => void
  onToggleAuto: (valve_id: string, auto: boolean) => void
}

export const ZoneCard: React.FC<Props> = ({ sensor, valve, onToggleValve, onToggleAuto }) => {
  const isOpen = valve?.status === 'open'
  const isAuto = valve?.auto_mode ?? true

  const humidityColor =
    sensor.status === 'red' ? '#ef4444' :
    sensor.status === 'yellow' ? '#fbbf24' : '#4ade80'

  const humidityBarWidth = `${Math.min(100, Math.max(0, sensor.humidity))}%`

  return (
    <div className="card p-5 flex flex-col gap-4 hover:border-green-700 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {sensor.zone_name}
          </div>
          <div className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sensor.sensor_id}
          </div>
        </div>
        <TrafficLight status={sensor.status} size="sm" />
      </div>

      {/* Humidity bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-1.5">
            <Droplets size={14} style={{ color: '#38bdf8' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Humedad</span>
          </div>
          <span className="mono font-medium text-sm" style={{ color: humidityColor }}>
            {sensor.humidity.toFixed(1)}%
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#1e2a18' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: humidityBarWidth, backgroundColor: humidityColor }}
          />
        </div>
      </div>

      {/* Temperature */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Thermometer size={14} style={{ color: '#f59e0b' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Temperatura</span>
        </div>
        <span className="mono text-sm" style={{ color: 'var(--text-primary)' }}>
          {sensor.temperature.toFixed(1)}°C
        </span>
      </div>

      {/* Valve control */}
      {valve && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Válvula
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isOpen ? '#4ade80' : '#ef4444' }}
              />
              <span className="mono text-xs" style={{ color: isOpen ? '#4ade80' : '#ef4444' }}>
                {isOpen ? 'ABIERTA' : 'CERRADA'}
              </span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onToggleAuto(valve.valve_id, true)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isAuto ? 'rgba(74,222,128,0.15)' : '#1e2a18',
                color: isAuto ? '#4ade80' : 'var(--text-muted)',
                border: `1px solid ${isAuto ? '#4ade80' : 'var(--border)'}`,
              }}
            >
              AUTO
            </button>
            <button
              onClick={() => onToggleAuto(valve.valve_id, false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: !isAuto ? 'rgba(251,191,36,0.15)' : '#1e2a18',
                color: !isAuto ? '#fbbf24' : 'var(--text-muted)',
                border: `1px solid ${!isAuto ? '#fbbf24' : 'var(--border)'}`,
              }}
            >
              MANUAL
            </button>
          </div>

          {/* Open/Close buttons */}
          {!isAuto && (
            <div className="flex gap-2">
              <button
                onClick={() => onToggleValve(valve.valve_id, 'open')}
                disabled={isOpen}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{
                  background: isOpen ? 'rgba(74,222,128,0.08)' : 'rgba(74,222,128,0.2)',
                  color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.3)',
                }}
              >
                Abrir
              </button>
              <button
                onClick={() => onToggleValve(valve.valve_id, 'close')}
                disabled={!isOpen}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{
                  background: !isOpen ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                Cerrar
              </button>
            </div>
          )}

          {isAuto && (
            <div
              className="text-center py-2 rounded-lg text-xs"
              style={{ background: '#1e2a18', color: 'var(--text-muted)' }}
            >
              Control automático activo
            </div>
          )}
        </div>
      )}
    </div>
  )
}
