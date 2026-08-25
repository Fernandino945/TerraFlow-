import React, { useCallback, useState } from 'react'
import {
  Database, Droplets, ToggleLeft, Sliders, Bell, MapPin, ShieldAlert,
  ChevronLeft, ChevronRight, RefreshCw, FileJson
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchCollections, fetchCollectionDocs, CollectionInfo, CollectionPage } from '../services/api'

const collectionMeta: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  sensor_history: { icon: <Droplets size={16} />, label: 'Historial de Sensores', color: '#38bdf8' },
  valve_states: { icon: <ToggleLeft size={16} />, label: 'Estado de Válvulas', color: '#4ade80' },
  thresholds: { icon: <Sliders size={16} />, label: 'Umbrales', color: '#fbbf24' },
  alerts: { icon: <Bell size={16} />, label: 'Alertas', color: '#f87171' },
  user_location: { icon: <MapPin size={16} />, label: 'Ubicación', color: '#a78bfa' },
  system_events: { icon: <ShieldAlert size={16} />, label: 'Eventos del Sistema', color: '#f59e0b' },
}

export const DatabaseExplorer: React.FC = () => {
  const [selected, setSelected] = useState<string>('sensor_history')
  const [page, setPage] = useState(1)
  const pageSize = 15

  const collectionsFetcher = useCallback(() => fetchCollections(), [])
  const { data: collections, loading: collectionsLoading, refetch: refetchCollections } =
    usePolling<CollectionInfo[]>(collectionsFetcher, 20000)

  const docsFetcher = useCallback(() => fetchCollectionDocs(selected, page, pageSize), [selected, page])
  const { data: docsPage, loading: docsLoading, refetch: refetchDocs } =
    usePolling<CollectionPage>(docsFetcher, 15000)

  const handleSelect = (name: string) => {
    setSelected(name)
    setPage(1)
  }

  const totalPages = docsPage ? Math.max(1, Math.ceil(docsPage.total / pageSize)) : 1

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Database size={20} style={{ color: '#4ade80' }} />
            Base de Datos
          </h1>
          <div className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            MongoDB — terraflow
          </div>
        </div>
        <button
          onClick={() => { refetchCollections(); refetchDocs() }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: '#1e2a18', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={13} className={collectionsLoading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Sidebar: lista de colecciones */}
        <div className="card p-4 flex flex-col gap-2" style={{ alignSelf: 'start' }}>
          <div className="text-xs font-semibold px-2 mb-1" style={{ color: 'var(--text-muted)' }}>
            COLECCIONES
          </div>
          {!collections && collectionsLoading ? (
            <div className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>Cargando...</div>
          ) : (
            collections?.map(col => {
              const meta = collectionMeta[col.name] || { icon: <FileJson size={16} />, label: col.name, color: '#7a9470' }
              const isActive = selected === col.name
              return (
                <button
                  key={col.name}
                  onClick={() => handleSelect(col.name)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    background: isActive ? `${meta.color}18` : 'transparent',
                    border: `1px solid ${isActive ? `${meta.color}40` : 'transparent'}`,
                    color: isActive ? meta.color : 'var(--text-muted)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {meta.icon}
                    <span className="text-left">{meta.label}</span>
                  </div>
                  <span
                    className="mono text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: isActive ? `${meta.color}25` : '#1e2a18' }}
                  >
                    {col.count}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Visor de documentos */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {collectionMeta[selected]?.icon}
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {collectionMeta[selected]?.label || selected}
              </span>
              <code className="mono text-xs px-2 py-0.5 rounded" style={{ background: '#1e2a18', color: 'var(--text-muted)' }}>
                db.{selected}.find()
              </code>
            </div>
            {docsPage && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {docsPage.total} documento{docsPage.total !== 1 ? 's' : ''} en total
              </span>
            )}
          </div>

          {docsLoading && !docsPage ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : !docsPage || docsPage.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
              <FileJson size={28} className="opacity-30" />
              <span className="text-sm">Sin documentos guardados aún en esta colección</span>
            </div>
          ) : (
            <>
              <DocumentTable documents={docsPage.documents} />

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: '#1e2a18', color: 'var(--text-muted)' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: '#1e2a18', color: 'var(--text-muted)' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Tabla genérica que renderiza cualquier documento de Mongo,
 * con columnas inferidas automáticamente desde las claves del primer documento.
 */
const DocumentTable: React.FC<{ documents: Record<string, any>[] }> = ({ documents }) => {
  // Unión de todas las claves presentes (por si algún doc tiene campos distintos)
  const columns = Array.from(
    documents.reduce((set, doc) => {
      Object.keys(doc).forEach(k => set.add(k))
      return set
    }, new Set<string>())
  )

  // _id primero, luego el resto en orden de aparición
  const ordered = ['_id', ...columns.filter(c => c !== '_id')]

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(2)
    if (typeof val === 'string') {
      // Detecta timestamps ISO y los acorta para lectura
      if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
        return val.replace('T', ' ').slice(0, 19)
      }
      return val
    }
    return JSON.stringify(val)
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: 480 }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {ordered.map(col => (
              <th
                key={col}
                className="text-left py-2 px-3 mono font-medium whitespace-nowrap"
                style={{ color: 'var(--text-muted)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, i) => (
            <tr
              key={doc._id || i}
              style={{ borderTop: '1px solid var(--border)' }}
              className="hover:bg-green-900/10 transition-colors"
            >
              {ordered.map(col => {
                const isStatusField = ['status', 'level', 'event_type'].includes(col)
                const val = doc[col]
                const statusColor =
                  val === 'red' || val === 'critical' || val === 'open' ? '#ef4444' :
                  val === 'yellow' || val === 'warning' ? '#fbbf24' :
                  val === 'green' || val === 'closed' || val === 'info' ? '#4ade80' : undefined

                return (
                  <td
                    key={col}
                    className="py-2 px-3 mono whitespace-nowrap"
                    style={{
                      color: col === '_id' ? 'var(--text-muted)' : isStatusField && statusColor ? statusColor : 'var(--text-primary)',
                      opacity: col === '_id' ? 0.5 : 1,
                      fontSize: col === '_id' ? 10 : 12,
                    }}
                  >
                    {formatValue(val)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
