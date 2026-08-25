import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { SensorReading } from '../../services/api'
import { format } from 'date-fns'

interface Props {
  history: SensorReading[]
  thresholds?: { warning_low: number; warning_high: number; critical_low: number; critical_high: number }
  zoneName?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs" style={{ minWidth: 140 }}>
      <div className="mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ color: '#38bdf8' }}>Humedad: {payload[0]?.value?.toFixed(1)}%</div>
      {payload[1] && <div style={{ color: '#f59e0b' }}>Temp: {payload[1]?.value?.toFixed(1)}°C</div>}
    </div>
  )
}

export const HumidityChart: React.FC<Props> = ({ history, thresholds, zoneName }) => {
  const data = history.slice(-60).map(r => ({
    time: format(new Date(r.timestamp), 'HH:mm'),
    humidity: r.humidity,
    temperature: r.temperature,
  }))

  if (data.length === 0) {
    return (
      <div className="card p-5 flex items-center justify-center" style={{ height: 200 }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin datos de historial</span>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Historial de Humedad
        </span>
        {zoneName && (
          <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: '#1e2a18', color: 'var(--text-muted)' }}>
            {zoneName}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3823" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#7a9470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#7a9470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Threshold lines */}
          {thresholds && (
            <>
              <ReferenceLine y={thresholds.critical_low} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
              <ReferenceLine y={thresholds.warning_low} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={thresholds.warning_high} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={thresholds.critical_high} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
            </>
          )}

          <Line
            type="monotone"
            dataKey="humidity"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#38bdf8' }}
          />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 3"
            activeDot={{ r: 3, fill: '#f59e0b' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <Legend color="#38bdf8" label="Humedad (%)" />
        <Legend color="#f59e0b" label="Temperatura (°C)" dashed />
        {thresholds && <Legend color="#ef4444" label="Umbrales críticos" dashed />}
      </div>
    </div>
  )
}

const Legend: React.FC<{ color: string; label: string; dashed?: boolean }> = ({ color, label, dashed }) => (
  <div className="flex items-center gap-1.5">
    <div style={{ width: 20, height: 2, background: color, opacity: dashed ? 0.6 : 1, borderTop: dashed ? `2px dashed ${color}` : undefined, background: dashed ? 'none' : color }} />
    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
  </div>
)
