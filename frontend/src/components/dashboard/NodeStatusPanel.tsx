import React from 'react'
import { Radio, Droplets, Thermometer, Clock, SignalHigh, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { NodeStatus } from '../../services/api'

interface Props {
  nodes: NodeStatus[]
}

const BADGE = {
  online: { label: 'EN LÍNEA', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  no_report: { label: 'SIN REPORTAR', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  never: { label: 'SIN NODO REAL', color: '#7a9470', bg: 'rgba(122,148,112,0.12)' },
} as const

function formatElapsed(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `hace ${seconds} s`
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`
  return `hace ${Math.floor(seconds / 86400)} d`
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min ${seconds % 60} s`
}

function signalLabel(rssi: number | null): { text: string; color: string } {
  if (rssi === null) return { text: '—', color: 'var(--text-muted)' }
  if (rssi >= -67) return { text: `${rssi} dBm (buena)`, color: '#4ade80' }
  if (rssi >= -80) return { text: `${rssi} dBm (regular)`, color: '#fbbf24' }
  return { text: `${rssi} dBm (débil)`, color: '#ef4444' }
}

export const NodeStatusPanel: React.FC<Props> = ({ nodes }) => {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          <Radio size={16} style={{ color: '#4ade80' }} />
          Diagnóstico de nodos sensores
        </div>
        {nodes.length > 0 && (
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Umbral sin reportar: {nodes[0].threshold_seconds} s
          </span>
        )}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {nodes.map(node => {
          const badge = BADGE[node.node_status]
          const signal = signalLabel(node.rssi)
          const reading = node.last_reading
          return (
            <div
              key={node.zone_id}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg-surface)', border: `1px solid ${node.node_status === 'no_report' ? 'rgba(239,68,68,0.5)' : 'var(--border)'}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{node.zone_name}</div>
                  <div className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{node.sensor_id}</div>
                </div>
                <span
                  className="mono text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap"
                  style={{ color: badge.color, background: badge.bg }}
                >
                  {badge.label}
                </span>
              </div>

              {node.node_status === 'never' ? (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Esta zona no ha recibido datos de un ESP32. Sus lecturas provienen del simulador.
                </div>
              ) : (
                <>
                  {reading ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Última lectura recibida</div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 mono text-sm" style={{ color: 'var(--text-primary)' }}>
                          <Droplets size={13} style={{ color: '#38bdf8' }} />
                          {reading.humidity.toFixed(1)}%
                        </span>
                        <span className="flex items-center gap-1.5 mono text-sm" style={{ color: 'var(--text-primary)' }}>
                          <Thermometer size={13} style={{ color: '#f59e0b' }} />
                          {reading.temperature.toFixed(1)}°C
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={12} />
                        {format(new Date(reading.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      El nodo contactó al servidor pero aún no hay una lectura válida.
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Último contacto</span>
                    <span className="mono" style={{ color: badge.color }}>{formatElapsed(node.seconds_since)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <SignalHigh size={12} /> Señal WiFi
                    </span>
                    <span className="mono" style={{ color: signal.color }}>{signal.text}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>Tiempo encendido</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{formatUptime(node.uptime_s)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>Lectura cruda (ADC)</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{node.raw_adc ?? '—'}</span>
                  </div>
                  {node.discarded_total > 0 && (
                    <div className="flex items-start gap-1.5 text-xs" style={{ color: '#fbbf24' }}>
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {node.discarded_total} lectura(s) descartada(s)
                        {node.last_discard_reason ? ` — última: ${node.last_discard_reason}` : ''}
                      </span>
                    </div>
                  )}
                  {node.node_status === 'no_report' && (
                    <div className="text-xs font-medium" style={{ color: '#ef4444' }}>
                      El nodo superó el umbral sin reportar. Revisar alimentación, WiFi y sensores.
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}