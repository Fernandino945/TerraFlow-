import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export interface SensorReading {
  sensor_id: string
  zone_name: string
  humidity: number
  temperature: number
  timestamp: string
  status: 'green' | 'yellow' | 'red'
}

export interface ValveState {
  valve_id: string
  zone_name: string
  status: 'open' | 'closed' | 'error'
  last_changed: string
  auto_mode: boolean
}

export interface Alert {
  alert_id: string
  level: 'info' | 'warning' | 'critical'
  message: string
  zone?: string
  timestamp: string
  acknowledged: boolean
}

export interface SystemStatus {
  overall: 'green' | 'yellow' | 'red'
  zones: SensorReading[]
  valves: ValveState[]
  alerts: Alert[]
  irrigation_suspended: boolean
  suspension_reason?: string
  last_updated: string
}

export interface WeatherForecast {
  timestamp: string
  temperature_2m: number
  precipitation: number
  precipitation_probability: number
  windspeed_10m: number
  weathercode: number
}

export interface WeatherSummary {
  current_temp: number
  hourly_forecast: WeatherForecast[]
  will_rain: boolean
  frost_risk: boolean
  saturation_risk: boolean
  irrigation_suspended: boolean
  suspension_reason?: string
}

export interface MonthlyReport {
  month: string
  total_irrigation_hours: number
  estimated_water_liters: number
  savings_vs_traditional_pct: number
  avg_humidity: number
  alerts_count: number
  zones_data: Record<string, { zone_name: string; avg_humidity: number; irrigation_hours: number }>
}

export interface HumidityThresholds {
  zone_id: string
  zone_name: string
  crop_type: string
  critical_low: number
  warning_low: number
  warning_high: number
  critical_high: number
}

// API calls
export const fetchSystemStatus = () => api.get<SystemStatus>('/sensors/status').then(r => r.data)
export const fetchWeather = () => api.get<WeatherSummary>('/weather/forecast').then(r => r.data)
export const fetchAlerts = () => api.get<Alert[]>('/alerts/').then(r => r.data)
export const fetchSensorHistory = (zoneId: string, limit = 60) =>
  api.get<SensorReading[]>(`/sensors/history?zone_id=${zoneId}&limit=${limit}`).then(r => r.data)
export const fetchMonthlyReport = () => api.get<MonthlyReport>('/reports/monthly').then(r => r.data)
export const fetchThresholds = () => api.get<HumidityThresholds[]>('/alerts/thresholds').then(r => r.data)

export const commandValve = (valve_id: string, action: 'open' | 'close', reason = 'manual') =>
  api.post<ValveState>('/valves/command', { valve_id, action, reason }).then(r => r.data)

export const setValveAutoMode = (valve_id: string, auto: boolean) =>
  api.post(`/valves/${valve_id}/auto?auto=${auto}`).then(r => r.data)

export const acknowledgeAlert = (alert_id: string) =>
  api.post(`/alerts/${alert_id}/acknowledge`).then(r => r.data)

export const updateThresholds = (zone_id: string, data: HumidityThresholds) =>
  api.put<HumidityThresholds>(`/alerts/thresholds/${zone_id}`, data).then(r => r.data)

export const refreshWeather = () =>
  api.post('/weather/refresh').then(r => r.data)

export interface UserLocation {
  latitude: number
  longitude: number
  location_name: string
}

export const fetchUserLocation = () => api.get<UserLocation>('/location/').then(r => r.data)
export const updateUserLocation = (loc: UserLocation) => api.put<UserLocation>('/location/', loc).then(r => r.data)

export interface SystemEvent {
  event_type: string
  detail: string
  timestamp: string
}
export const fetchSystemEvents = (limit = 50) =>
  api.get<SystemEvent[]>(`/alerts/system-events?limit=${limit}`).then(r => r.data)

export interface CollectionInfo {
  name: string
  count: number
}
export interface CollectionPage {
  documents: Record<string, any>[]
  total: number
  page: number
  page_size: number
}

export const fetchCollections = () => api.get<CollectionInfo[]>('/database/collections').then(r => r.data)
export const fetchCollectionDocs = (name: string, page = 1, pageSize = 20) =>
  api.get<CollectionPage>(`/database/collections/${name}?page=${page}&page_size=${pageSize}`).then(r => r.data)

export default api
