import React, { useState } from 'react'
import { Sprout } from 'lucide-react'
import { applyMoistureLevel, HumidityThresholds } from '../../services/api'

const LEVELS = [
  { level: 1, label: 'Ligeramente seco' },
  { level: 2, label: 'Seco moderado' },
  { level: 3, label: 'Equilibrado' },
  { level: 4, label: 'Húmedo' },
  { level: 5, label: 'Muy húmedo' },
]

interface Props {
  threshold: HumidityThresholds
  onApplied: () => void
}

export const MoistureScale: React.FC<Props> = ({ threshold, onApplied }) => {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = threshold.moisture_level ?? null

  const choose = async (level: number) => {
    if (level === current) return
    setBusy(level)
    setError(null)
    try {
      await applyMoistureLevel(threshold.zone_id, level)
      onApplied()
    } catch {
      setError('No se pudo aplicar el nivel. Revisa la conexión con la API.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center gap-2 font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
        <Sprout size={16} style={{ color: '#4ade80' }} />
        Humedad objetivo — {threshold.zone_name}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Elige cuánta humedad debe mantener el suelo, de 1 (ligeramente seco) a 5 (muy húmedo). El sistema ajusta
        solo los umbrales de riego. Son valores de referencia; para un cultivo específico usa el perfil fenológico
        o edita los umbrales a mano.
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }} role="radiogroup" aria-label="Humedad objetivo">
        {LEVELS.map(({ level, label }) => {
          const active = current === level
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy !== null}
              onClick={() => choose(level)}
              className="flex flex-col items-center gap-1 py-3 px-1 rounded-lg text-xs font-semibold"
              style={{
                background: active ? 'rgba(74,222,128,0.25)' : '#1e2a18',
                color: active ? '#4ade80' : 'var(--text-primary)',
                border: `1px solid ${active ? 'rgba(74,222,128,0.6)' : 'var(--border)'}`,
                opacity: busy !== null && busy !== level ? 0.6 : 1,
              }}
            >
              <span className="mono" style={{ fontSize: 18 }}>{level}</span>
              <span style={{ fontWeight: 500 }}>{label}</span>
            </button>
          )
        })}
      </div>
      <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        {current
          ? <>Nivel activo: <span style={{ color: '#4ade80' }}>{current} · {LEVELS[current - 1].label}</span></>
          : 'Umbrales personalizados (no coinciden con ningún nivel de la escala).'}
        {' '}Riega bajo <span className="mono">{threshold.warning_low}%</span> y se detiene sobre <span className="mono">{threshold.warning_high}%</span>.
      </div>
      {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
