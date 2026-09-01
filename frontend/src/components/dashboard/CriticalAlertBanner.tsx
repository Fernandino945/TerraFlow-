import React from 'react'
import { AlertOctagon } from 'lucide-react'
import { Alert } from '../../services/api'

export const CriticalAlertBanner: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const critical = alerts.filter(a => a.level === 'critical' && !a.acknowledged)
  if (critical.length === 0) return null

  return (
    <div className="rounded-xl p-4 mb-6 animate-pulse"
         style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertOctagon size={20} color="#ef4444" />
        <span className="font-bold text-lg" style={{ color: '#ef4444' }}>Alerta Crítica</span>
      </div>
      {critical.map(a => (
        <div key={a.alert_id} className="text-sm" style={{ color: '#fca5a5' }}>{a.message}</div>
      ))}
    </div>
  )
}