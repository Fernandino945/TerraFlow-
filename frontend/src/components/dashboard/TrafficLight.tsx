import React from 'react'

interface Props {
  status: 'green' | 'yellow' | 'red'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showLabel?: boolean
}

const statusConfig = {
  green: {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.15)',
    label: 'Normal',
    pulse: 'status-pulse-green',
  },
  yellow: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.15)',
    label: 'Atención',
    pulse: 'status-pulse-yellow',
  },
  red: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.15)',
    label: 'Crítico',
    pulse: 'status-pulse-red',
  },
}

const sizes = { sm: 12, md: 20, lg: 32 }

export const TrafficLight: React.FC<Props> = ({ status, size = 'md', label, showLabel = true }) => {
  const cfg = statusConfig[status]
  const px = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <div
        className={cfg.pulse}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span className="text-sm font-medium" style={{ color: cfg.color }}>
          {label || cfg.label}
        </span>
      )}
    </div>
  )
}

export const TrafficLightBig: React.FC<{ status: 'green' | 'yellow' | 'red' }> = ({ status }) => {
  const cfg = statusConfig[status]
  const labels = { green: 'SISTEMA NORMAL', yellow: 'REQUIERE ATENCIÓN', red: 'ALERTA CRÍTICA' }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* Semáforo visual */}
      <div
        className="flex flex-col gap-3 p-4 rounded-2xl"
        style={{ background: '#0d1510', border: '2px solid #2a3823' }}
      >
        {(['red', 'yellow', 'green'] as const).map(s => (
          <div
            key={s}
            className={s === status ? statusConfig[s].pulse : ''}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: s === status ? statusConfig[s].color : '#1e2a18',
              border: `2px solid ${s === status ? statusConfig[s].color : '#2a3823'}`,
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>
      <div className="text-center">
        <div className="mono text-xs" style={{ color: 'var(--text-muted)' }}>ESTADO DEL PREDIO</div>
        <div className="font-bold text-lg mt-1" style={{ color: cfg.color }}>
          {labels[status]}
        </div>
      </div>
    </div>
  )
}
