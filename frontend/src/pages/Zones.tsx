import React, { useCallback, useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchSystemStatus, fetchSensorHistory, fetchThresholds, updateThresholds,
  commandValve, setValveAutoMode, fetchPhenologyProfiles, applyPhenologyProfile,
  SystemStatus, HumidityThresholds,
} from '../services/api'
import { HumidityChart } from '../components/charts/HumidityChart'
import { ZoneCard } from '../components/dashboard/ZoneCard'
import { Sliders, Leaf } from 'lucide-react'

export const Zones: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState<string>('zone_1')
  const [editingThreshold, setEditingThreshold] = useState<HumidityThresholds | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string>('')
  const [selectedPhase, setSelectedPhase] = useState<string>('')
  const [applyingProfile, setApplyingProfile] = useState(false)

  const statusFetcher = useCallback(() => fetchSystemStatus(), [])
  const historyFetcher = useCallback(() => fetchSensorHistory(selectedZone, 120), [selectedZone])
  const thresholdsFetcher = useCallback(() => fetchThresholds(), [])
  const profilesFetcher = useCallback(() => fetchPhenologyProfiles(), [])

  const { data: status, refetch: refetchStatus } = usePolling<SystemStatus>(statusFetcher, 10000)
  const { data: history } = usePolling(historyFetcher, 30000)
  const { data: thresholds, refetch: refetchThresholds } = usePolling<HumidityThresholds[]>(thresholdsFetcher, 60000)
  const { data: profiles } = usePolling(profilesFetcher, 300000)

  const selectedThreshold = thresholds?.find(t => t.zone_id === selectedZone)
  const availablePhases = selectedCrop && profiles?.[selectedCrop] ? Object.keys(profiles[selectedCrop]) : []

  const handleToggleValve = async (valve_id: string, action: 'open' | 'close') => {
    await commandValve(valve_id, action, 'Control manual desde Zonas')
    refetchStatus()
  }
  const handleToggleAuto = async (valve_id: string, auto: boolean) => {
    await setValveAutoMode(valve_id, auto)
    refetchStatus()
  }

  const handleSaveThreshold = async () => {
    if (!editingThreshold) return
    try {
      await updateThresholds(editingThreshold.zone_id, editingThreshold)
      setEditingThreshold(null)
      refetchThresholds()
    } catch {}
  }

  const handleApplyProfile = async () => {
    if (!selectedCrop || !selectedPhase) return
    setApplyingProfile(true)
    try {
      await applyPhenologyProfile(selectedZone, selectedCrop, selectedPhase)
      refetchThresholds()
    } catch {
    } finally {
      setApplyingProfile(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Gestión de Zonas
      </h1>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        {status?.zones.map(zone => {
          const valve = status.valves.find(v => v.valve_id === zone.sensor_id.replace('sensor_', ''))
          return (
            <div
              key={zone.sensor_id}
              onClick={() => setSelectedZone(zone.sensor_id.replace('sensor_', ''))}
              className="cursor-pointer"
              style={{ outline: selectedZone === zone.sensor_id.replace('sensor_', '') ? '2px solid #4ade80' : 'none', borderRadius: 12 }}
            >
              <ZoneCard
                sensor={zone}
                valve={valve}
                onToggleValve={handleToggleValve}
                onToggleAuto={handleToggleAuto}
              />
            </div>
          )
        })}
      </div>

      {/* History chart */}
      {history && (
        <div className="mt-6">
          <HumidityChart
            history={history}
            thresholds={selectedThreshold}
            zoneName={status?.zones.find(z => z.sensor_id === `sensor_${selectedZone}`)?.zone_name}
          />
        </div>
      )}

      {/* Phenology profile selector */}
      {selectedThreshold && (
        <div className="card p-5 mt-6">
          <div className="flex items-center gap-2 font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            <Leaf size={16} style={{ color: '#4ade80' }} />
            Configuración Fenológica — {selectedThreshold.zone_name}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Tipo de cultivo</label>
              <select
                value={selectedCrop}
                onChange={e => { setSelectedCrop(e.target.value); setSelectedPhase('') }}
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: '#1e2a18', border: '1px solid rgba(74,222,128,0.3)', color: 'var(--text-primary)' }}
              >
                <option value="">Seleccionar cultivo</option>
                {profiles && Object.keys(profiles).map(crop => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Fase fenológica</label>
              <select
                value={selectedPhase}
                onChange={e => setSelectedPhase(e.target.value)}
                disabled={!selectedCrop}
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: '#1e2a18', border: '1px solid rgba(74,222,128,0.3)', color: 'var(--text-primary)' }}
              >
                <option value="">Seleccionar fase</option>
                {availablePhases.map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleApplyProfile}
              disabled={!selectedCrop || !selectedPhase || applyingProfile}
              className="text-sm px-4 py-2 rounded-lg font-semibold"
              style={{
                background: 'rgba(74,222,128,0.2)', color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.4)',
                opacity: (!selectedCrop || !selectedPhase || applyingProfile) ? 0.5 : 1,
              }}
            >
              {applyingProfile ? 'Aplicando...' : 'Aplicar perfil'}
            </button>
          </div>

          {selectedThreshold.phenological_phase && (
            <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Perfil activo: <span style={{ color: '#4ade80' }}>{selectedThreshold.crop_type} — {selectedThreshold.phenological_phase}</span>
            </div>
          )}
        </div>
      )}

      {/* Threshold editor */}
      {selectedThreshold && (
        <div className="card p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              <Sliders size={16} style={{ color: '#4ade80' }} />
              Umbrales de Humedad — {selectedThreshold.zone_name}
            </div>
            <button
              onClick={() => setEditingThreshold(editingThreshold ? null : { ...selectedThreshold })}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
            >
              {editingThreshold ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['critical_low', 'warning_low', 'warning_high', 'critical_high'] as const).map(key => {
              const labels = { critical_low: 'Crítico bajo', warning_low: 'Aviso bajo', warning_high: 'Aviso alto', critical_high: 'Crítico alto' }
              const colors = { critical_low: '#ef4444', warning_low: '#fbbf24', warning_high: '#fbbf24', critical_high: '#ef4444' }
              return (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{labels[key]}</label>
                  {editingThreshold ? (
                    <input
                      type="number"
                      min={0} max={100} step={1}
                      value={editingThreshold[key]}
                      onChange={e => setEditingThreshold({ ...editingThreshold, [key]: Number(e.target.value) })}
                      className="mono text-sm px-3 py-2 rounded-lg w-full"
                      style={{ background: '#1e2a18', border: `1px solid ${colors[key]}40`, color: colors[key] }}
                    />
                  ) : (
                    <div className="mono text-lg font-bold" style={{ color: colors[key] }}>
                      {selectedThreshold[key]}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {editingThreshold && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveThreshold}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)' }}
              >
                Guardar cambios
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}