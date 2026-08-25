import React, { useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { fetchMonthlyReport, MonthlyReport } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Droplets, Clock, TrendingDown, AlertTriangle, BarChart2 } from 'lucide-react'

export const Reports: React.FC = () => {
  const reportFetcher = useCallback(() => fetchMonthlyReport(), [])
  const { data: report, loading } = usePolling<MonthlyReport>(reportFetcher, 120000)

  if (loading && !report) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Generando reporte...</span>
      </div>
    )
  }

  if (!report) return null

  const zoneChartData = Object.entries(report.zones_data).map(([id, z]) => ({
    name: z.zone_name.split(' - ')[1] || z.zone_name,
    horas: z.irrigation_hours,
    humedad: z.avg_humidity,
  }))

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reportes</h1>
          <div className="mono text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
            {report.month}
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mono"
          style={{ background: '#1e2a18', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <BarChart2 size={12} />
          Reporte mensual
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Clock size={16} style={{ color: '#38bdf8' }} />}
          label="Horas de riego"
          value={report.total_irrigation_hours.toFixed(1)}
          suffix="h"
          color="#38bdf8"
        />
        <KpiCard
          icon={<Droplets size={16} style={{ color: '#0ea5e9' }} />}
          label="Agua estimada"
          value={(report.estimated_water_liters / 1000).toFixed(1)}
          suffix="m³"
          color="#0ea5e9"
        />
        <KpiCard
          icon={<TrendingDown size={16} style={{ color: '#4ade80' }} />}
          label="Ahorro vs tradicional"
          value={report.savings_vs_traditional_pct.toFixed(1)}
          suffix="%"
          color="#4ade80"
          highlight
        />
        <KpiCard
          icon={<AlertTriangle size={16} style={{ color: '#fbbf24' }} />}
          label="Alertas generadas"
          value={report.alerts_count}
          color="#fbbf24"
        />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Irrigation hours by zone */}
        <div className="card p-5">
          <div className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Horas de Riego por Zona
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3823" />
              <XAxis dataKey="name" tick={{ fill: '#7a9470', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#7a9470', fontSize: 10 }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#171e13', border: '1px solid #2a3823', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e8f0e2' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Bar dataKey="horas" radius={[4, 4, 0, 0]}>
                {zoneChartData.map((_, i) => (
                  <Cell key={i} fill={['#38bdf8', '#0ea5e9', '#0284c7', '#075985'][i % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average humidity by zone */}
        <div className="card p-5">
          <div className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Humedad Promedio por Zona
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3823" />
              <XAxis dataKey="name" tick={{ fill: '#7a9470', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#7a9470', fontSize: 10 }} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#171e13', border: '1px solid #2a3823', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e8f0e2' }}
                itemStyle={{ color: '#4ade80' }}
              />
              <Bar dataKey="humedad" radius={[4, 4, 0, 0]}>
                {zoneChartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.humedad < 35 ? '#ef4444' : entry.humedad > 75 ? '#fbbf24' : '#4ade80'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Zone detail table */}
        <div className="card p-5 col-span-2">
          <div className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Detalle por Zona
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left pb-2 font-medium">Zona</th>
                <th className="text-right pb-2 font-medium">Hum. prom.</th>
                <th className="text-right pb-2 font-medium">Horas riego</th>
                <th className="text-right pb-2 font-medium">Agua est. (L)</th>
                <th className="text-right pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.zones_data).map(([id, z]) => {
                const waterEst = Math.round(z.irrigation_hours * 450)
                const st = z.avg_humidity < 35 ? 'bajo' : z.avg_humidity > 75 ? 'alto' : 'normal'
                const stColor = st === 'normal' ? '#4ade80' : st === 'bajo' ? '#ef4444' : '#fbbf24'
                return (
                  <tr key={id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2.5" style={{ color: 'var(--text-primary)' }}>{z.zone_name}</td>
                    <td className="text-right mono py-2.5" style={{ color: '#38bdf8' }}>{z.avg_humidity.toFixed(1)}%</td>
                    <td className="text-right mono py-2.5" style={{ color: 'var(--text-muted)' }}>{z.irrigation_hours.toFixed(1)} h</td>
                    <td className="text-right mono py-2.5" style={{ color: 'var(--text-muted)' }}>{waterEst.toLocaleString('es-CL')}</td>
                    <td className="text-right py-2.5">
                      <span className="mono text-xs px-2 py-0.5 rounded-full" style={{ color: stColor, background: `${stColor}18` }}>
                        {st}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Savings callout */}
          <div
            className="mt-4 flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <TrendingDown size={20} style={{ color: '#4ade80' }} />
            <div>
              <span className="font-semibold text-sm" style={{ color: '#4ade80' }}>
                {report.savings_vs_traditional_pct.toFixed(1)}% de ahorro hídrico
              </span>
              <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>
                respecto a métodos de riego tradicional este mes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string | number;
  suffix?: string; color: string; highlight?: boolean
}> = ({ icon, label, value, suffix, color, highlight }) => (
  <div
    className="card p-4 flex flex-col gap-2"
    style={highlight ? { border: `1px solid ${color}40`, background: `${color}08` } : {}}
  >
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="mono text-2xl font-bold" style={{ color }}>{value}</span>
      {suffix && <span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
    </div>
  </div>
)
