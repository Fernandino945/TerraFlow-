import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost';
const KEY = __ENV.KEY || '';
const H = { headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' } };

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const ing = http.post(`${BASE}/api/sensors/ingest`, JSON.stringify({
    sensor_id: 'sensor_zone_1', humidity: 55, temperature: 20, raw_adc: 1800, rssi: -60, uptime_s: 100,
  }), H);
  check(ing, { 'ingest 200': (r) => r.status === 200 });

  const hb = http.post(`${BASE}/api/sensors/gateway/heartbeat`, JSON.stringify({
    sensor_id: 'sensor_zone_1', rssi: -60, uptime_s: 100, failsafe_active: false, failure_count: 0,
  }), H);
  check(hb, { 'heartbeat 200': (r) => r.status === 200 });

  const st = http.get(`${BASE}/api/sensors/status`);
  check(st, { 'status 200': (r) => r.status === 200 });
  const sc = http.get(`${BASE}/api/irrigation/schedule`);
  check(sc, { 'schedule 200': (r) => r.status === 200 });

  sleep(1);
}
