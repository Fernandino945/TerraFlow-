import React, { useCallback, useContext, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Clock, CloudSun, Droplets, Leaf, Thermometer, WifiOff } from 'lucide-react'
import { TerraFlowContext } from '../context/TerraFlowContext'
import { TrafficLightBig } from '../components/dashboard/TrafficLight'
import { ZoneCard } from '../components/dashboard/ZoneCard'
import { NodeStatusPanel } from '../components/dashboard/NodeStatusPanel'
import { WeatherPanel } from '../components/dashboard/WeatherPanel'
import { AlertsPanel } from '../components/alerts/AlertsPanel'
import { HumidityChart } from '../components/charts/HumidityChart'
import { CriticalAlertBanner } from '../components/dashboard/CriticalAlertBanner'
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton'
import { EfficiencyPanel } from '../components/dashboard/EfficiencyPanel'
import { usePolling } from '../hooks/usePolling'
import {
  Alert, NodeStatus, SystemStatus, WeatherSummary,
  commandValve, fetchAlerts, fetchIrrigationSchedule, fetchNodeStatus, fetchSensorHistory, fetchSystemStatus, fetchWeather, setValveAutoMode,
} from '../services/api'

export const Dashboard: React.FC = () => {
  const statusFetcher = useCallback(() => fetchSystemStatus(), [])
  const weatherFetcher = useCallback(() => fetchWeather(), [])
  const alertsFetcher = useCallback(() => fetchAlerts(), [])
  const historyFetcher = useCallback(() => fetchSensorHistory('zone_1', 60), [])
  const nodesFetcher = useCallback(() => fetchNodeStatus(), [])
  const scheduleFetcher = useCallback(() => fetchIrrigationSchedule(), [])
  const { data: status, loading: statusLoading, error: statusError, refetch: refetchStatus } = usePolling<SystemStatus>(statusFetcher, 10000)
  const { data: weather, loading: weatherLoading, error: weatherError, refetch: refetchWeather } = usePolling<WeatherSummary>(weatherFetcher, 60000)
  const { data: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = usePolling<Alert[]>(alertsFetcher, 15000)
  const { data: history, loading: historyLoading, error: historyError, refetch: refetchHistory } = usePolling(historyFetcher, 30000)
  const { data: nodes, loading: nodesLoading, error: nodesError, refetch: refetchNodes } = usePolling<NodeStatus[]>(nodesFetcher, 10000)

  const handleToggleValve = async (valve_id: string, action: 'open' | 'close') => {
    try {
      await commandValve(valve_id, action, 'Intervención manual desde dashboard')
      refetchStatus()
    } catch (error) {
      console.error('No se pudo cambiar la válvula', error)
    }
  }

  const handleToggleAuto = async (valve_id: string, auto: boolean) => {
    try {
      await setValveAutoMode(valve_id, auto)
      refetchStatus()
    } catch (error) {
      console.error('No se pudo cambiar el modo de la válvula', error)
    }
  }

  const { data: schedule } = usePolling(scheduleFetcher, 60000)
  const { setConnection, refreshVersion } = useContext(TerraFlowContext)
  const refreshAll = useCallback(() => {
    refetchStatus()
    refetchWeather()
    refetchAlerts()
    refetchHistory()
    refetchNodes()
  }, [refetchStatus, refetchWeather, refetchAlerts, refetchHistory, refetchNodes])
  useEffect(() => {
    if (refreshVersion > 0) refreshAll()
  }, [refreshVersion, refreshAll])
  const now = format(new Date(), "EEEE d 'de' MMMM, HH:mm", { locale: es })
  const nodeList = Array.isArray(nodes) ? nodes : null
  const alertList = Array.isArray(alerts) ? alerts : null
  const historyList = Array.isArray(history) ? history : null
  const weatherData = weather && Number.isFinite(weather.current_temp) && Array.isArray(weather.hourly_forecast) ? weather : null
  const nodesMessage = nodesError || (nodes && !nodeList ? 'La API devolvió un diagnóstico de nodos con formato inesperado.' : null)
  const alertsMessage = alertsError || (alerts && !alertList ? 'La API devolvió alertas con formato inesperado.' : null)
  const historyMessage = historyError || (history && !historyList ? 'La API devolvió un historial con formato inesperado.' : null)
  const weatherMessage = weatherError || (weather && !weatherData ? 'La API devolvió un pronóstico con formato inesperado.' : null)
  const onlineNodes = nodeList?.filter(node => node.node_status === 'online').length ?? null
  const activeAlerts = alertList?.filter(alert => !alert.acknowledged).length ?? null
  const zones = Array.isArray(status?.zones) ? status.zones : []
  const valves = Array.isArray(status?.valves) ? status.valves : []
  const validSystemStatus = Boolean(status && ['green', 'yellow', 'red'].includes(status.overall) && Array.isArray(status.zones) && Array.isArray(status.valves))
  const statusMessage = statusError || (!validSystemStatus && status ? 'La API respondió con un estado incompleto. Comprueba el servicio antes de operar las válvulas.' : null)
  const hasPanelErrors = Boolean(statusMessage || nodesMessage || alertsMessage || historyMessage || weatherMessage)
  useEffect(() => {
    setConnection(hasPanelErrors ? 'offline' : statusLoading && !status ? 'loading' : 'online')
  }, [setConnection, hasPanelErrors, statusLoading, status])

  return (
    <main className="tf-dashboard">
      <section className="tf-hero" aria-label="Resumen del huerto">
        <img className="tf-hero__image" src="/terraflow-orchard.png" alt="Filas de árboles frutales en un huerto al amanecer" />
        <div className="tf-hero__shade" />
        <div className="tf-hero__content">
          <div className="tf-eyebrow tf-hero__eyebrow"><span className="tf-eyebrow__dot" /> CUADERNO DE CAMPO · ESTACIÓN 01</div>
          <h1>El huerto,<br /><em>en equilibrio.</em></h1>
          <p>Una lectura viva de cada parcela, cada gota y cada decisión.</p>
          <div className="tf-hero__meta"><span><Leaf size={14} /> Monitoreo de precisión</span><span className="tf-hero__divider" /><span className="capitalize">{now}</span>{schedule?.enabled && <><span className="tf-hero__divider" /><span><Clock size={14} /> Riego automático {schedule.start}–{schedule.end} · {schedule.allowed_now ? 'dentro del horario' : 'fuera del horario'}</span></>}</div>
        </div>
        <div className="tf-hero__stamp" aria-hidden="true"><span>TF</span><small>CAMPO<br />CONECTADO</small></div>
        <div className="tf-hero__fade" />
      </section>

      <div className="tf-content">
        {alertList && <CriticalAlertBanner alerts={alertList} />}
        {status?.irrigation_suspended && (
          <div className="tf-suspension" role="status">
            <AlertTriangle size={18} />
            <div><strong>Riego suspendido automáticamente</strong><span>{status.suspension_reason || 'El sistema ha detenido el riego por seguridad.'}</span></div>
            <span className="tf-suspension__tag">PAUSA ACTIVA</span>
          </div>
        )}

        <header className="tf-section-head">
          <div>
            <div className="tf-eyebrow">LECTURA DEL SISTEMA</div>
            <h2>Estado del predio</h2>
            <p className="tf-section-head__note">Las condiciones actuales, de un vistazo.</p>
          </div>
        </header>

        {statusLoading && !status ? <DashboardSkeleton /> : validSystemStatus && status ? (
          <>
            <section className="tf-overview" aria-label="Resumen del sistema">
              <div className="tf-overview__signal">
                <div className="tf-card-index">01 / ESTADO GENERAL</div>
                <TrafficLightBig status={status.overall} />
              </div>
              <div className="tf-metrics">
                <Metric label="Zonas en línea" value={onlineNodes === null ? '—' : onlineNodes} suffix={valves.length ? `/ ${valves.length}` : undefined} icon={<Leaf size={17} />} tone="green" note={nodesLoading ? 'Actualizando nodos' : nodesMessage && nodeList ? 'Último dato disponible' : 'Nodos ESP32'} />
                <Metric label="Alertas activas" value={activeAlerts === null ? '—' : activeAlerts} icon={<AlertTriangle size={17} />} tone={alertList?.some(alert => !alert.acknowledged && alert.level === 'critical') ? 'red' : 'amber'} note={alertsMessage && alertList ? 'Último dato disponible' : 'Pendientes de atención'} />
                <Metric label="Temperatura" value={weatherData?.current_temp.toFixed(1) ?? '—'} suffix="°C" icon={<Thermometer size={17} />} tone="earth" note={weatherLoading && !weatherData ? 'Consultando estación' : weatherMessage && weatherData ? 'Último dato disponible' : 'Lectura ambiente'} />
              </div>
            </section>

            <section className="tf-zones-section">
              <div className="tf-subhead"><div><span className="tf-eyebrow">02 / PARCELAS</span><h3>Zonas de cultivo</h3></div><span className="tf-count">{zones.length.toString().padStart(2, '0')} zonas</span></div>
              {zones.length ? <div className="tf-zone-grid">{zones.map((zone, index) => {
                const valve = valves.find(item => item.valve_id === zone.sensor_id.replace('sensor_', ''))
                return <div className="tf-zone-wrap" key={zone.sensor_id}><span className="tf-zone-number">PARCELA {String(index + 1).padStart(2, '0')}</span><ZoneCard sensor={zone} valve={valve} onToggleValve={handleToggleValve} onToggleAuto={handleToggleAuto} /></div>
              })}</div> : <EmptyPanel title="Sin zonas registradas" detail="Cuando la API informe parcelas, aparecerán aquí sus lecturas y controles." />}
            </section>

            <section className="tf-insights-grid">
              <div className="tf-insight-main">
                <div className="tf-subhead"><div><span className="tf-eyebrow">03 / TENDENCIA</span><h3>Humedad en el suelo</h3></div><span className="tf-count">ÚLTIMAS 60 LECTURAS</span></div>
                {historyList ? <HumidityChart history={historyList} zoneName={historyList[0]?.zone_name || 'Zona 1'} /> : <DataPanelState loading={historyLoading} error={historyMessage} title="Historial de humedad" />}
              </div>
              <div className="tf-insight-side">
                <div className="tf-subhead"><div><span className="tf-eyebrow">04 / ALERTAS</span><h3>Atención del campo</h3></div></div>
                {alertList ? <AlertsPanel alerts={alertList} onRefresh={refetchAlerts} /> : <DataPanelState loading={alertsLoading} error={alertsMessage} title="Alertas" />}
              </div>
            </section>

            <EfficiencyPanel />

            <section className="tf-climate-section">
              <div className="tf-subhead"><div><span className="tf-eyebrow">06 / CONDICIONES</span><h3>Clima y pronóstico</h3></div><span className="tf-count"><CloudSun size={14} /> ESTACIÓN LOCAL</span></div>
              {weatherData ? <WeatherPanel weather={weatherData} onRefresh={refetchWeather} /> : <DataPanelState loading={weatherLoading} error={weatherMessage} title="Pronóstico climático" />}
            </section>

            <section className="tf-nodes-section">
              <div className="tf-subhead"><div><span className="tf-eyebrow">07 / TELEMETRÍA</span><h3>Nodos ESP32</h3></div><span className="tf-count">DIAGNÓSTICO</span></div>
              {nodeList ? <NodeStatusPanel nodes={nodeList} /> : <DataPanelState loading={nodesLoading} error={nodesMessage} title="Diagnóstico de nodos" />}
            </section>
            <footer className="tf-footer"><span>TERRAFLOW · CUADERNO DE CAMPO DIGITAL</span><span>Datos obtenidos desde la API de tu predio</span></footer>
          </>
        ) : (
          <div className="tf-offline-dashboard">
            <div className="tf-offline-intro"><div className="tf-offline-intro__mark"><WifiOff size={19} /></div><div><span className="tf-eyebrow">ESTADO DE CONEXIÓN</span><h2>Esperando señal del predio</h2><p>La API no entregó un estado completo. El tablero conserva los paneles y controles, sin sustituir lecturas reales por valores de muestra.</p></div></div>
            <section className="tf-offline-zones"><div className="tf-subhead"><div><span className="tf-eyebrow">02 / PARCELAS</span><h3>Zonas de cultivo</h3></div></div><DataPanelState loading={statusLoading} error={statusMessage} title="Zonas de cultivo y controles de válvula" /></section>
            <section className="tf-insights-grid"><div className="tf-insight-main"><div className="tf-subhead"><div><span className="tf-eyebrow">03 / TENDENCIA</span><h3>Humedad en el suelo</h3></div></div>{historyList ? <HumidityChart history={historyList} zoneName={historyList[0]?.zone_name || 'Zona 1'} /> : <DataPanelState loading={historyLoading} error={historyMessage} title="Historial de humedad" />}</div><div className="tf-insight-side"><div className="tf-subhead"><div><span className="tf-eyebrow">04 / ALERTAS</span><h3>Atención del campo</h3></div></div>{alertList ? <AlertsPanel alerts={alertList} onRefresh={refetchAlerts} /> : <DataPanelState loading={alertsLoading} error={alertsMessage} title="Alertas" />}</div></section>
            <EfficiencyPanel />
            <section className="tf-climate-section"><div className="tf-subhead"><div><span className="tf-eyebrow">06 / CONDICIONES</span><h3>Clima y pronóstico</h3></div></div>{weatherData ? <WeatherPanel weather={weatherData} onRefresh={refetchWeather} /> : <DataPanelState loading={weatherLoading} error={weatherMessage} title="Pronóstico climático" />}</section>
            <section className="tf-nodes-section"><div className="tf-subhead"><div><span className="tf-eyebrow">07 / TELEMETRÍA</span><h3>Nodos ESP32</h3></div></div>{nodeList ? <NodeStatusPanel nodes={nodeList} /> : <DataPanelState loading={nodesLoading} error={nodesMessage} title="Diagnóstico de nodos" />}</section>
            <footer className="tf-footer"><span>TERRAFLOW · CUADERNO DE CAMPO DIGITAL</span><span>Los datos reaparecerán cuando la API vuelva a estar disponible</span></footer>
          </div>
        )}
      </div>
    </main>
  )
}

const Metric: React.FC<{ label: string; value: string | number; suffix?: string; icon: React.ReactNode; tone: string; note: string }> = ({ label, value, suffix, icon, tone, note }) => (
  <div className={`tf-metric tf-metric--${tone}`}><div className="tf-metric__head"><span>{label}</span><span className="tf-metric__icon">{icon}</span></div><div className="tf-metric__value">{value}<small>{suffix}</small></div><div className="tf-metric__note"><span className="tf-metric__dot" />{note}</div></div>
)

const DataPanelState: React.FC<{ loading: boolean; error: string | null; title: string }> = ({ loading, error, title }) => (
  <div className="tf-data-state" role={error ? 'alert' : 'status'}>{loading ? <><div className="tf-spinner" /><strong>Conectando con {title.toLowerCase()}…</strong><span>Conservaremos el último dato en cuanto esté disponible.</span></> : error ? <><WifiOff size={20} /><strong>No se pudo actualizar {title.toLowerCase()}</strong><span>{error}. Comprueba la conexión con la API; no se muestran datos inventados.</span></> : <><Droplets size={20} /><strong>Sin datos disponibles</strong><span>La API todavía no ha enviado lecturas para este panel.</span></>}</div>
)

const EmptyPanel: React.FC<{ title: string; detail: string }> = ({ title, detail }) => <div className="tf-empty"><Droplets size={20} /><strong>{title}</strong><span>{detail}</span></div>
