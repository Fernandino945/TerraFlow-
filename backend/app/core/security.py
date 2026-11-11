import secrets
from typing import Optional
from fastapi import Header, HTTPException
from app.core.config import settings


async def require_node_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")):
    """Exige la clave del nodo. Si el servidor no tiene clave configurada, rechaza todo (falla cerrado)."""
    expected = settings.NODE_API_KEY
    if not expected:
        raise HTTPException(status_code=503, detail="NODE_API_KEY no configurada en el servidor")
    if x_api_key is None:
        raise HTTPException(status_code=401, detail="Falta la cabecera X-API-Key")
    if not secrets.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="API key invalida")
