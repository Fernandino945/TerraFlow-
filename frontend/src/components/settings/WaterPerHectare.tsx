import React, { useMemo, useState } from 'react'
import { Droplets } from 'lucide-react'

type Method = 'drip' | 'hose'

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '—')

export const WaterPerHectare: React.FC = () => {
  const [method, setMethod] = useState<Method>('drip')
  // Valores de ejemplo editables: reemplázalos con los de tu instalación.
  const [emitterLph, setEmitterLph] = useState('2')
  const [emitterSpacing, setEmitterSpacing] = useState('0.5')
  const [lineSpacing, setLineSpacing] = useState('1.5')
  const [hoseLpm, setHoseLpm] = useState('7.5')
  const [hosesPerHa, setHosesPerHa] = useState('4')

  const litersPerHaHour = useMemo(() => {
    if (method === 'drip') {
      const perEmitter = Number(emitterLph)
      const area = Number(emitterSpacing) * Number(lineSpacing)
      return area > 0 ? (10000 / area) * perEmitter : NaN
    }
    return Number(hoseLpm) * 60 * Number(hosesPerHa)
  }, [method, emitterLph, emitterSpacing, lineSpacing, hoseLpm, hosesPerHa])

  const inputStyle = { background: '#1e2a18', border: '1px solid var(--border)', color: 'var(--text-primary)' }
  const num = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type="number" min="0" step="any" value={value} onChange={e => set(e.target.value)} className="px-3 py-2 rounded-lg text-sm mono" style={inputStyle} />
      {hint && <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{hint}</p>}
    </div>
  )

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 font-semibold text-sm pb-2 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
        <Droplets size={15} style={{ color: '#38bdf8' }} />
        Agua por hectárea y hora (referencial)
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Método de riego">
        {([['drip', 'Goteo'], ['hose', 'Manguera / flujo abierto']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: method === value ? 'rgba(74,222,128,0.25)' : '#1e2a18',
              color: method === value ? '#4ade80' : 'var(--text-primary)',
              border: `1px solid ${method === value ? 'rgba(74,222,128,0.6)' : 'var(--border)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {method === 'drip' ? (
        <div className="grid grid-cols-3 gap-4">
          {num('Caudal por gotero (L/h)', emitterLph, setEmitterLph)}
          {num('Distancia entre goteros (m)', emitterSpacing, setEmitterSpacing)}
          {num('Distancia entre líneas (m)', lineSpacing, setLineSpacing)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {num('Caudal por manguera (L/min)', hoseLpm, setHoseLpm, 'Mídelo llenando un balde y cronometrando.')}
          {num('Mangueras regando a la vez por hectárea', hosesPerHa, setHosesPerHa)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Result label="Litros por hectárea y hora" value={`${fmt(litersPerHaHour)} L`} />
        <Result label="Metros cúbicos por hectárea y hora" value={`${fmt(litersPerHaHour / 1000)} m³`} />
        <Result label="Lámina equivalente por hora" value={`${fmt(litersPerHaHour / 10000)} mm`} />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Cálculo teórico con los datos que ingreses (los valores iniciales son solo un ejemplo). No es una medición
        del prototipo ni una recomendación de riego: el consumo real depende del caudal medido, la presión y el cultivo.
        El goteo entrega el agua en cada planta, mientras que la manguera abierta suele mojar más superficie.
      </p>
    </div>
  )
}

const Result: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-lg" style={{ background: '#1e2a18', border: '1px solid var(--border)' }}>
    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div className="mono font-semibold mt-1" style={{ color: '#38bdf8' }}>{value}</div>
  </div>
)
