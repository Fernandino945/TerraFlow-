from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
from app.core import state
from app.models.schemas import ValveState, ValveCommand, ValveStatus, AlertLevel

router = APIRouter()

@router.get("/", response_model=List[ValveState])
async def get_all_valves():
    return list(state.valve_states.values())

@router.post("/command", response_model=ValveState)
async def command_valve(cmd: ValveCommand):
    """Activa o desactiva una válvula manualmente."""
    valve = state.valve_states.get(cmd.valve_id)
    if not valve:
        raise HTTPException(status_code=404, detail=f"Válvula '{cmd.valve_id}' no encontrada")

    new_status = ValveStatus.OPEN if cmd.action == "open" else ValveStatus.CLOSED
    valve.status = new_status
    valve.last_changed = datetime.utcnow()
    valve.auto_mode = False  # Modo manual
    state.persist_valve(valve)

    state.add_alert(
        AlertLevel.INFO,
        f"Válvula {valve.zone_name} {'abierta' if new_status == ValveStatus.OPEN else 'cerrada'} manualmente. Razón: {cmd.reason}",
        zone=valve.zone_name,
    )
    return valve

@router.post("/{valve_id}/auto")
async def set_auto_mode(valve_id: str, auto: bool = True):
    """Activa/desactiva el modo automático de una válvula."""
    valve = state.valve_states.get(valve_id)
    if not valve:
        raise HTTPException(status_code=404, detail="Válvula no encontrada")
    valve.auto_mode = auto
    state.persist_valve(valve)
    return {"valve_id": valve_id, "auto_mode": auto}
