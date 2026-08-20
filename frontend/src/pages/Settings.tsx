import React, { useCallback, useEffect, useState } from 'react'
import { MapPin, Thermometer, CloudRain, Droplets, Save, LocateFixed, ShieldAlert } from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchUserLocation, updateUserLocation, UserLocation,
  fetchSystemEvents, SystemEvent,
} from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClimateConfig {
  frost_threshold: string
  rain_threshold: string
  humidity_critical_low: string
  humidity_critical_high: string
}

const DEFAULT_CLIMATE: ClimateConfig = {
  frost_threshold: '8',
  rain_threshold: '5',
  humidity_critical_low: '25',
  humidity_critical_high: '85',
}

export const Settings: React.FC = () => {
  const [location, setLocation] = useState<UserLocation>({ latitude: -33.45, longitude: -70.66, location_name: 'Predio Principal' })
  const [climate, setClimate] = useState<ClimateConfig>(DEFAULT_CLIMATE)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const eventsFetcher = useCallback(() => fetchSystemEvents(20), [])
  const { data: events } = usePolling<SystemEvent[]>(eventsFetcher, 30000)

  useEffect(() => {
    fetchUserLocation().then(setLocation).catch(() => {})
  }, [])

  const updateClimate = (key: keyof ClimateConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setClimate(c => ({ ...c, [key]: e.target.value }))

  const handleUseMyLocation = () => {
    setLocError(null)
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation(l => ({
          ...l,
          latitude: Math.round(pos.coords.latitude * 10000) / 10000,
          longitude: Math.round(pos.coords.longitude * 10000) / 10000,
        }))
        setLocating(false)
      },
      err => {
        setLocError('No se pudo obtener tu ubicación: ' + err.message)
        setLocating(false)
      }
    )
  }

  const handleSave = async () => {
    try {
      await updateUserLocation(location)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setLocError('No se pudo guardar la ubicación en el servidor')
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Configuración
        </h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: saved ? 'rgba(74,222,128,0.25)' : 'rgba(74,222,128,0.15)',
            color: '#4ade80',
            border: '1px solid rgba(74,222,128,0.35)',
          }}
        >
          <Save size={14} />
          {saved ? '¡Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Location */}
        <Section icon={<MapPin size={15} style={{ color: '#4ade80' }} />} title="Ubicación del Predio">
          <Field label="Nombre del predio" value={location.location_name} onChange={e => setLocation(l => ({ ...l, location_name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Latitud"
              value={String(location.latitude)}
              onChange={e => setLocation(l => ({ ...l, latitude: Number(e.target.value) }))}
              type="number"
            />
            <Field
              label="Longitud"
              value={String(location.longitude)}
              onChange={e => setLocation(l => ({ ...l, longitude: Number(e.target.value) }))}
              type="number"
            />
          </div>

          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#1e2a18', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
          >
            <LocateFixed size={14} className={locating ? 'animate-spin' : ''} />
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
          </button>

          {locError && <p className="text-xs" style={{ color: '#ef4444' }}>{locError}</p>}

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Estas coordenadas se guardan en el servidor y se usan para obtener el pronóstico
            meteorológico real de Open-Meteo específico para tu zona.
          </p>
        </Section>

        {/* Climate thresholds */}
        <Section icon={<Thermometer size={15} style={{ color: '#f59e0b' }} />} title="Umbrales Climáticos">
          <Field
            label="Temperatura de helada (°C)"
            hint="Riego suspendido si temperatura prevista cae bajo este valor"
            value={climate.frost_threshold}
            onChange={updateClimate('frost_threshold')}
            type="number"
          />
          <Field
            label="Lluvia de suspensión (mm/12h)"
            hint="Riego suspendido si lluvia acumulada prevista supera este valor"
            value={climate.rain_threshold}
            onChange={updateClimate('rain_threshold')}
            type="number"
          />
        </Section>

        {/* Default humidity thresholds */}
        <Section icon={<Droplets size={15} style={{ color: '#38bdf8' }} />} title="Umbrales de Humedad por Defecto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Crítico bajo (%)" value={climate.humidity_critical_low} onChange={updateClimate('humidity_critical_low')} type="number" />
            <Field label="Crítico alto (%)" value={climate.humidity_critical_high} onChange={updateClimate('humidity_critical_high')} type="number" />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Estos son los umbrales por defecto para nuevas zonas. Cada zona puede tener umbrales individuales desde la página de Zonas.
          </p>
        </Section>

        {/* Risk mitigation / failsafe log */}
        <Section icon={<ShieldAlert size={15} style={{ color: '#fbbf24' }} />} title="Mitigación de Riesgo Técnico">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            El sistema vigila constantemente que el motor de decisión esté activo (watchdog).
            Si deja de recibir señales por más de 90 segundos, todas las válvulas se cierran
            automáticamente como estado seguro por defecto, y el evento queda registrado aquí.
          </p>

          {!events || events.length === 0 ? (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-xs"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
            >
              Sin incidentes registrados — el sistema no ha activado el modo de seguridad.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded-lg text-xs"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
                >
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" style={{ color: '#fbbf24' }} />
                  <div>
                    <div style={{ color: '#fbbf24' }}>{ev.detail}</div>
                    <div className="mono mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* About */}
        <div className="card p-5">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Acerca de TerraFlow</div>
            <div className="flex flex-col gap-1">
              <span>Versión: <span className="mono">1.1.0</span></span>
              <span>API climática: <span className="mono">Open-Meteo (gratuita, sin API key)</span></span>
              <span>Backend: <span className="mono">FastAPI + Python 3.11</span></span>
              <span>Base de datos: <span className="mono">MongoDB</span></span>
              <span>Frontend: <span className="mono">React 18 + TypeScript + Vite</span></span>
              <span>Infraestructura: <span className="mono">Docker Compose</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon, title, children
}) => (
  <div className="card p-5 flex flex-col gap-4">
    <div className="flex items-center gap-2 font-semibold text-sm pb-2 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
      {icon}
      {title}
    </div>
    {children}
  </div>
)

const Field: React.FC<{
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; hint?: string
}> = ({ label, value, onChange, type = 'text', hint }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="px-3 py-2 rounded-lg text-sm mono"
      style={{
        background: '#1e2a18',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        outline: 'none',
      }}
      onFocus={e => (e.target.style.borderColor = 'rgba(74,222,128,0.5)')}
      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
    />
    {hint && <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{hint}</p>}
  </div>
)
