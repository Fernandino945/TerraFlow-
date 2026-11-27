import React, { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { fetchIrrigationSchedule, updateIrrigationSchedule, IrrigationSchedule } from '../../services/api'

export const IrrigationScheduleSection: React.FC = () => {
  const [schedule, setSchedule] = useState<IrrigationSchedule | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [start, setStart] = useState('20:00')
  const [end, setEnd] = useState('08:00')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const apply = (s: IrrigationSchedule) => {
    setSchedule(s)
    setEnabled(s.enabled)
    setStart(s.start)
    setEnd(s.end)
  }

  useEffect(() => {
    fetchIrrigationSchedule().then(apply).catch(() => setMessage({ ok: false, text: 'No se pudo leer el horario desde la API.' }))
  }, [])

  const save = async () => {
    try {
      apply(await updateIrrigationSchedule({ enabled, start, end }))
      setMessage({ ok: true, text: 'Horario guardado.' })
    } catch {
      setMessage({ ok: false, text: 'No se pudo guardar el horario.' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const inputStyle = { background: '#1e2a18', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 font-semibold text-sm pb-2 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
        <Clock size={15} style={{ color: '#38bdf8' }} />
        Horario de riego automático
      </div>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        Regar automáticamente solo dentro de esta ventana
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Desde</label>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="px-3 py-2 rounded-lg text-sm mono" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Hasta</label>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="px-3 py-2 rounded-lg text-sm mono" style={inputStyle} />
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Sugerencia de un productor: regar de noche o de madrugada (20:00 a 08:00) para reducir la evaporación.
        Fuera de la ventana el modo automático no abre las válvulas y cierra las que estén abiertas; si la
        humedad llega a nivel crítico, avisa para que decidas un riego manual. El modo manual no se bloquea.
        {schedule && <> Zona horaria: <span className="mono">{schedule.timezone}</span>.</>}
      </p>
      {schedule && (
        <div className="text-xs" style={{ color: schedule.allowed_now ? '#4ade80' : '#fbbf24' }}>
          {!schedule.enabled
            ? 'Ventana desactivada: el riego automático funciona a cualquier hora.'
            : schedule.allowed_now ? 'Ahora estás dentro del horario de riego.' : 'Ahora estás fuera del horario de riego.'}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={start === end && enabled}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)' }}
        >
          Guardar horario
        </button>
        {message && <span className="text-xs" style={{ color: message.ok ? '#4ade80' : '#ef4444' }}>{message.text}</span>}
      </div>
    </div>
  )
}
