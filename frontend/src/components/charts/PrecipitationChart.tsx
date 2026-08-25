import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { WeatherForecast } from '../../services/api'
import { format } from 'date-fns'

interface Props {
  forecast: WeatherForecast[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs" style={{ minWidth: 140 }}>
      <div className="mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ color: '#38bdf8' }}>Precipitación: {payload[0]?.value?.toFixed(1)} mm</div>
      {payload[1] && (
        <div style={{ color: '#7a9470' }}>Probabilidad: {payload[1]?.value?.toFixed(0)}%</div>
      )}
    </div>
  )
}

export const PrecipitationChart: React.FC<Props> = ({ forecast }) => {
  const data = forecast.slice(0, 24).map(f => ({
    time: format(new Date(f.timestamp), 'HH:mm'),
    precipitation: f.precipitation,
    probability: f.precipitation_probability,
  }))

  return (
    <div className="card p-5">
      <div className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
        Precipitaciones Previstas (24h)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3823" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#7a9470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#7a9470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="precipitation" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.precipitation > 5 ? '#0284c7' : entry.precipitation > 1 ? '#38bdf8' : '#1e4a6a'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
