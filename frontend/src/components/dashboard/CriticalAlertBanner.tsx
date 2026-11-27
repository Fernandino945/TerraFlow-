import React from 'react'
import { AlertOctagon } from 'lucide-react'
import { Alert } from '../../services/api'

export const CriticalAlertBanner: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const critical = alerts.filter(a => a.level === 'critical' && !a.acknowledged)
  if (critical.length === 0) return null

  return (
    <div className="tf-critical-banner" role="alert">
      <div className="flex items-center gap-2 mb-2">
        <AlertOctagon size={20} aria-hidden="true" />
        <strong className="font-bold text-lg">Alerta crítica · atención inmediata</strong>
      </div>
      {critical.map(alert => <div key={alert.alert_id} className="text-sm">{alert.message}</div>)}
    </div>
  )
}
