import React, { useCallback, useState } from 'react'
import { Droplets, Clock3, Gauge, TrendingDown, RefreshCw } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { fetchMonthlyReport, MonthlyReport } from '../../services/api'

type PeriodDays = 7 | 30

export const EfficiencyPanel: React.FC = () => {
  const [period, setPeriod] = useState<PeriodDays>(7)
  const reportFetcher = useCallback(() => fetchMonthlyReport(period), [period])
  const { data: report, loading, error, refetch } = usePolling<MonthlyReport>(reportFetcher, 120000)
  const reportUsable = Boolean(report && report.zones_data && typeof report.zones_data === 'object' && Number.isFinite(report.calibrated_flow_lpm) && Number.isFinite(report.used_water_liters) && Number.isFinite(report.traditional_reference_liters) && Number.isFinite(report.total_irrigation_hours) && Number.isFinite(report.savings_vs_traditional_pct))
  const reportError = error || (report && !reportUsable ? 'La API devolvió un reporte de eficiencia incompleto.' : null)
  const zones = reportUsable && report ? Object.entries(report.zones_data).map(([id, zone]) => {
    const used = zone.irrigation_hours * 60 * report.calibrated_flow_lpm
    const comparison = report.used_water_liters > 0 ? report.traditional_reference_liters / report.used_water_liters : 1
    return { id, name: zone.zone_name.split(' - ').slice(-1)[0], used, traditional: used * comparison }
  }) : []
  const maxValue = Math.max(1, ...zones.map(zone => zone.traditional))

  return (
    <section className="tf-efficiency" aria-labelledby="efficiency-title">
      <div className="tf-efficiency__top"><div><span className="tf-eyebrow">05 / AGUA Y RENDIMIENTO</span><h3 id="efficiency-title">Cada gota, bien contada.</h3><p>Consumo medido frente a la referencia tradicional del predio.</p></div>
        <div className="tf-period-picker" role="group" aria-label="Periodo del reporte de eficiencia">{([7, 30] as const).map(days => <button type="button" key={days} className={period === days ? 'is-selected' : ''} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} días</button>)}</div>
      </div>
      {loading && !report ? <EfficiencySkeleton /> : reportUsable && report ? <>
        <div className="tf-efficiency__stats">
          <EfficiencyStat icon={<Droplets size={17} />} label="Agua utilizada" value={`${report.used_water_liters.toLocaleString('es-CL')} L`} tone="water" />
          <EfficiencyStat icon={<Droplets size={17} />} label="Referencia tradicional" value={`${report.traditional_reference_liters.toLocaleString('es-CL')} L`} tone="soil" />
          <EfficiencyStat icon={<TrendingDown size={17} />} label="Ahorro de agua" value={`${report.savings_vs_traditional_pct.toFixed(1)}%`} tone="green" />
          <EfficiencyStat icon={<Clock3 size={17} />} label="Tiempo de riego" value={`${report.total_irrigation_hours.toFixed(1)} h`} tone="amber" />
        </div>
        <div className="tf-efficiency__bottom">
          <div className="tf-zone-comparison"><div className="tf-chart-heading"><div><strong>Consumo por zona</strong><span>Litros estimados en el periodo seleccionado</span></div><button className="tf-icon-button" type="button" onClick={refetch} aria-label="Actualizar eficiencia"><RefreshCw size={15} /></button></div>
            {zones.length ? <div className="tf-bars" role="img" aria-label="Comparación de litros usados y referencia tradicional por zona">{zones.map(zone => <div className="tf-bar-row" key={zone.id}><div className="tf-bar-label">{zone.name}</div><div className="tf-bar-pair"><div className="tf-bar tf-bar--used" style={{ width: `${Math.max(2, zone.used / maxValue * 100)}%` }} title={`Usado: ${Math.round(zone.used).toLocaleString('es-CL')} litros`} /><div className="tf-bar tf-bar--reference" style={{ width: `${Math.max(2, zone.traditional / maxValue * 100)}%` }} title={`Referencia: ${Math.round(zone.traditional).toLocaleString('es-CL')} litros`} /></div><div className="tf-bar-value">{Math.round(zone.used).toLocaleString('es-CL')} <small>L</small></div></div>)}</div> : <div className="tf-empty tf-empty--compact">Sin zonas en este periodo.</div>}
            <div className="tf-legend"><span><i className="tf-legend__used" />Uso medido</span><span><i className="tf-legend__reference" />Referencia</span></div>
          </div>
          <div className="tf-flow-note"><div className="tf-flow-note__icon"><Gauge size={19} /></div><div><span>CAUDAL CALIBRADO</span><strong>{report.calibrated_flow_lpm.toFixed(1)} <small>L/min</small></strong><p>Medición aplicada al cálculo de consumo.</p></div></div>
        </div>
        {error && <div className="tf-stale-note" role="status">No se pudo actualizar. Se conserva el último dato disponible.</div>}
      </> : <div className="tf-data-state" role={reportError ? 'alert' : 'status'}>{reportError ? <><strong>No se pudo cargar el reporte hídrico</strong><span>{reportError} Revisa la conexión con la API.</span></> : <><strong>Sin datos de eficiencia para este periodo</strong><span>Cuando existan eventos de riego aparecerán aquí.</span></>}</div>}
    </section>
  )
}

const EfficiencyStat: React.FC<{ icon: React.ReactNode; label: string; value: string; tone: string }> = ({ icon, label, value, tone }) => <div className={`tf-eff-stat tf-eff-stat--${tone}`}><div className="tf-eff-stat__label">{icon}<span>{label}</span></div><strong>{value}</strong></div>

const EfficiencySkeleton: React.FC = () => <div className="tf-efficiency__loading" aria-label="Cargando datos de eficiencia"><div className="tf-efficiency__stats">{[0, 1, 2, 3].map(item => <div className="tf-skeleton tf-skeleton--eff-stat" key={item} />)}</div><div className="tf-skeleton tf-skeleton--comparison" /><span className="tf-skeleton-caption">Consultando consumo del periodo…</span></div>
