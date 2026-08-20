"""
Scheduler de tareas periódicas.

IMPORTANTE: BackgroundScheduler corre los jobs en threads normales, SIN event loop.
Como state.py dispara guardados en Mongo vía asyncio.create_task() (fire-and-forget),
esas tasks necesitan un loop async vivo para ejecutarse — si no, se descartan en
silencio y nada llega a la base de datos (bug detectado: sensor_history y
valve_states quedaban vacíos pese a que el dashboard funcionaba normal).

Solución: se crea UN loop de asyncio dedicado, corriendo en un thread propio durante
toda la vida del proceso, y cada job se ejecuta DENTRO de ese loop con
run_coroutine_threadsafe. Así las tasks de guardado en Mongo sí completan.
"""
import asyncio
import threading
from apscheduler.schedulers.background import BackgroundScheduler
from app.core import state
from app.services import weather_service, irrigation_logic, watchdog

scheduler = BackgroundScheduler()

# Loop async dedicado para que las tasks de persistencia (Mongo) tengan dónde correr
_async_loop = asyncio.new_event_loop()


def _start_async_loop():
    asyncio.set_event_loop(_async_loop)
    _async_loop.run_forever()


def _run_in_async_loop(coro):
    """Ejecuta una corrutina dentro del loop dedicado, esperando su resultado."""
    future = asyncio.run_coroutine_threadsafe(coro, _async_loop)
    return future.result()


async def _sensors_job_async():
    state.refresh_all_sensors()
    irrigation_logic.evaluate_auto_irrigation()
    # Esperar a que todas las escrituras a Mongo disparadas arriba terminen
    await state.wait_pending_writes()


def refresh_sensors_job():
    _run_in_async_loop(_sensors_job_async())


def refresh_weather_job():
    _run_in_async_loop(weather_service.refresh_cache())


def watchdog_job():
    async def _watchdog_async():
        watchdog.check_watchdog()
        await state.wait_pending_writes()
    _run_in_async_loop(_watchdog_async())


def start_scheduler():
    # Arrancar el loop dedicado en un thread daemon antes de programar los jobs
    loop_thread = threading.Thread(target=_start_async_loop, daemon=True)
    loop_thread.start()

    scheduler.add_job(refresh_sensors_job, "interval", seconds=30, id="sensors")
    scheduler.add_job(refresh_weather_job, "interval", minutes=15, id="weather")
    scheduler.add_job(watchdog_job, "interval", seconds=20, id="watchdog")
    scheduler.start()
