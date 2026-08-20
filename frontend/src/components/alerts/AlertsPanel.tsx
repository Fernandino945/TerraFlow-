import React from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCheck, Bell } from 'lucide-react'
import { Alert, acknowledgeAlert } from '../../services/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  alerts: Alert[]
  onRefresh: () => void
}

const levelConfig = {
  info: { icon: <Info size={14} />, color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  warning: { icon: <AlertTriangle size={14} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  critical: { icon: <AlertCircle size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
}

export const AlertsPanel: React.FC<Props> = ({ alerts, onRefresh }) => {
  const handleAck = async (id: string) => {
    try {
      await acknowledgeAlert(id)
      onRefresh()
    } catch {}
  }

  const active = alerts.filter(a => !a.acknowledged)
  const acknowledged = alerts.filter(a => a.acknowledged)

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={15} style={{ color: 'var(--text-muted)' }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Alertas</span>
        </div>
        {active.length > 0 && (
          <div
            className="mono text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
          >
            {active.length} activa{active.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <CheckCheck size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin alertas activas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {active.map(alert => (
            <AlertItem key={alert.alert_id} alert={alert} onAck={handleAck} />
          ))}
          {acknowledged.slice(0, 3).map(alert => (
            <AlertItem key={alert.alert_id} alert={alert} onAck={handleAck} dimmed />
          ))}
        </div>
      )}
    </div>
  )
}

const AlertItem: React.FC<{ alert: Alert; onAck: (id: string) => void; dimmed?: boolean }> = ({
  alert, onAck, dimmed
}) => {
  const cfg = levelConfig[alert.level]
  const timeAgo = formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true, locale: es })

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg transition-opacity"
      style={{
        background: dimmed ? '#1a2016' : cfg.bg,
        border: `1px solid ${dimmed ? 'var(--border)' : cfg.border}`,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: dimmed ? 'var(--text-muted)' : cfg.color }}>
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs" style={{ color: dimmed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {alert.message}
        </div>
        {alert.zone && (
          <div className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {alert.zone}
          </div>
        )}
        <div className="mono text-xs mt-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {timeAgo}
        </div>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={() => onAck(alert.alert_id)}
          className="shrink-0 p-1 rounded hover:bg-green-900 transition-colors"
          title="Confirmar"
          style={{ color: 'var(--text-muted)' }}
        >
          <CheckCheck size={12} />
        </button>
      )}
    </div>
  )
}
