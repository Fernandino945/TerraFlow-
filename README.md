# 🌱 TerraFlow — Plataforma IoT de Riego Inteligente

Sistema de automatización de riego agrícola de lazo cerrado con dashboard web en tiempo real, integración climática, persistencia en MongoDB, control manual/automático de válvulas y mitigación de riesgo técnico (watchdog/failsafe).

---

## 🏗️ Arquitectura

```
terraflow/
├── backend/          # FastAPI — Python 3.11
│   └── app/
│       ├── api/      # Endpoints REST (sensors, valves, weather, alerts, reports, location)
│       ├── core/     # Config, scheduler, state store, conexión MongoDB
│       ├── models/   # Schemas Pydantic
│       └── services/ # Weather (Open-Meteo), lógica de riego, watchdog/failsafe
├── frontend/         # React 18 + TypeScript + Vite
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── services/ # API client
├── nginx/            # Proxy reverso
└── docker-compose.yml
```

---

## 🚀 Inicio rápido

### Prerrequisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Puertos libres: **80**, **5173**, **8000**, **27017**

### 1. Levantar todo el sistema

```bash
docker compose up --build
```

Primera vez demora ~3-5 minutos mientras descarga imágenes e instala dependencias (incluye MongoDB).

### 2. Acceder a la aplicación

| Servicio         | URL                          |
|------------------|------------------------------|
| Dashboard web    | http://localhost             |
| Dashboard (dev)  | http://localhost:5173        |
| API REST         | http://localhost:8000/api    |
| Swagger UI       | http://localhost:8000/docs   |
| MongoDB          | mongodb://localhost:27017    |

---

## 🖥️ Explorador visual de la Base de Datos

En vez de depender de `mongosh` o instalar MongoDB Compass por separado, el dashboard
incluye una página propia: **Base de Datos** (en el menú lateral).

Permite:
- Ver todas las colecciones de MongoDB con su cantidad de documentos
- Navegar los documentos de cada colección en una tabla legible (no JSON crudo)
- Paginar resultados (15 documentos por página)
- Identificar visualmente campos de estado (verde/amarillo/rojo, abierta/cerrada) con color

Internamente consume dos endpoints nuevos:
```
GET /api/database/collections                 → lista de colecciones + conteo
GET /api/database/collections/{name}?page=1    → documentos paginados de una colección
```

Si de todas formas prefieres una herramienta externa, [MongoDB Compass](https://www.mongodb.com/products/compass)
se conecta directo a `mongodb://localhost:27017`.

---

## 🗄️ Persistencia con MongoDB

Todo el estado relevante se guarda en MongoDB (colecciones dentro de la base `terraflow`):

| Colección          | Contenido                                          |
|---------------------|-----------------------------------------------------|
| `sensor_history`    | Cada lectura de humedad/temperatura por zona        |
| `valve_states`      | Estado actual de cada válvula (abierta/cerrada/auto)|
| `thresholds`        | Umbrales de humedad configurados por zona           |
| `alerts`            | Historial completo de alertas                       |
| `user_location`     | Ubicación configurada para el pronóstico            |
| `system_events`     | Activaciones del watchdog/failsafe                  |

**Esto resuelve el riesgo de pérdida de datos:** si el backend se reinicia, al arrancar
(`load_state_from_db` en `main.py`) recupera válvulas, umbrales, alertas recientes e
historial reciente desde MongoDB — el sistema ya no "olvida" todo al caerse.

Para inspeccionar los datos directamente:
```bash
docker exec -it terraflow-mongo mongosh terraflow
> db.sensor_history.find().limit(5)
> db.valve_states.find()
> db.system_events.find()
```

---

## 📍 Ubicación del usuario y pronóstico

Desde **Configuración → Ubicación del Predio** se puede:
- Ingresar manualmente latitud/longitud
- Usar el botón **"Usar mi ubicación actual"** (geolocalización del navegador)

Al guardar, el backend recalcula inmediatamente el pronóstico de Open-Meteo para esas
coordenadas exactas vía `PUT /api/location/`, y la ubicación queda persistida en MongoDB
para sobrevivir reinicios.

---

## 🛡️ Mitigación de riesgo técnico (Watchdog / Failsafe)

Mecanismo de seguridad ante caídas del motor de decisión:

- El scheduler de sensores actualiza un **heartbeat** cada 30 segundos.
- Un job de **watchdog** corre cada 20 segundos y verifica que el heartbeat no esté vencido.
- Si pasan más de `WATCHDOG_TIMEOUT_SECONDS` (90s por defecto) sin heartbeat, se asume que
  el sistema de decisión está caído y se **fuerza el cierre de todas las válvulas**
  (estado seguro "normally-closed").
- El evento se registra en `system_events` y es visible en **Configuración → Mitigación de Riesgo Técnico**.

```
Heartbeat OK (cada 30s)
       │
       ▼
Watchdog revisa cada 20s
       │
   ¿heartbeat > 90s?
       │
      Sí → Cierra todas las válvulas + registra evento + alerta CRÍTICA
```

Esto cubre el escenario de una caída del backend: las válvulas **no quedan regando
indefinidamente** — el sistema prioriza no inundar/saturar el suelo por sobre seguir
regando sin supervisión.

---

## ⚙️ Variables de entorno

Edita `docker-compose.yml` para personalizar:

| Variable                     | Default                | Descripción                              |
|-------------------------------|-------------------------|--------------------------------------------|
| `LATITUDE` / `LONGITUDE`      | `-33.45` / `-70.66`     | Coordenadas iniciales del predio          |
| `LOCATION_NAME`               | `Predio Principal`      | Nombre del predio                         |
| `SIMULATE_SENSORS`            | `true`                  | Simular sensores IoT                      |
| `FROST_TEMP_THRESHOLD`        | `8.0`                   | °C bajo el que se suspende riego          |
| `RAIN_SUSPENSION_THRESHOLD`   | `5.0`                   | mm lluvia/12h para suspender riego        |
| `MONGO_URI`                   | `mongodb://mongo:27017` | Cadena de conexión a MongoDB              |
| `MONGO_DB_NAME`               | `terraflow`             | Nombre de la base de datos                |
| `WATCHDOG_TIMEOUT_SECONDS`    | `90`                    | Segundos sin heartbeat antes del failsafe |
| `FAILSAFE_VALVE_STATE`        | `closed`                | Estado seguro forzado ante caída          |

---

## 🔌 API REST — Endpoints principales

```
GET  /api/sensors/status     → Estado general del sistema (semáforo + zonas + válvulas)
GET  /api/sensors/history    → Historial de lecturas por zona (desde MongoDB)
GET  /api/weather/forecast   → Pronóstico Open-Meteo con evaluación de riego
POST /api/weather/refresh    → Forzar actualización del pronóstico
POST /api/valves/command     → Abrir/cerrar válvula manualmente
POST /api/valves/{id}/auto   → Activar/desactivar modo automático
GET  /api/alerts/            → Alertas activas
GET  /api/alerts/thresholds  → Umbrales de humedad por zona
PUT  /api/alerts/thresholds/{zone_id} → Actualizar umbrales (persistido en Mongo)
GET  /api/alerts/system-events → Historial de activaciones de failsafe
GET  /api/location/          → Ubicación configurada para el pronóstico
PUT  /api/location/          → Actualizar ubicación (recalcula pronóstico al instante)
GET  /api/reports/monthly    → Reporte mensual de consumo hídrico
```

---

## 🧠 Lógica de lazo cerrado

```
Sensores IoT (cada 30s)
       ↓
Motor de Decisión
       ├── Humedad < umbral_crítico_bajo  → Abre válvula + Alerta CRÍTICA
       ├── Humedad < umbral_aviso_bajo    → Abre válvula + Alerta WARNING
       ├── Humedad > umbral_crítico_alto  → Cierra válvula + Alerta CRÍTICA
       ├── Humedad > umbral_aviso_alto    → Cierra válvula + Alerta WARNING
       └── Zona verde                     → Sin acción

Pronóstico Open-Meteo (cada 15 min, según ubicación configurada)
       ├── Lluvia prevista > 5mm/12h      → Suspende riego global
       ├── Temperatura < 8°C              → Suspende riego global (helada)
       └── Prob. saturación > 70%+10mm   → Suspende riego global

Watchdog (cada 20s)
       └── Sin heartbeat > 90s            → FAILSAFE: cierra todas las válvulas
```

---

## 🛑 Detener el sistema

```bash
docker compose down
```

Para eliminar también los volúmenes (incluyendo los datos de MongoDB):
```bash
docker compose down -v
```

---

## 🗂️ Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f

# Ver sólo logs del backend
docker compose logs -f backend

# Acceder a la shell de MongoDB
docker exec -it terraflow-mongo mongosh terraflow

# Reiniciar sólo el frontend (si editas código)
docker compose restart frontend

# Reconstruir una sola imagen
docker compose up --build backend
```

---

## 📦 Stack tecnológico

| Capa          | Tecnología                                          |
|----------------|-----------------------------------------------------|
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS, Recharts  |
| Backend        | FastAPI, Python 3.11, Pydantic v2, APScheduler       |
| Base de datos  | MongoDB 7 (driver async: Motor)                      |
| API Clima      | Open-Meteo (gratuita, sin API key)                  |
| Proxy          | Nginx Alpine                                          |
| Infra          | Docker + Docker Compose                               |
# TerraFlow-