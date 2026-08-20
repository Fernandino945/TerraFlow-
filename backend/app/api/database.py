from fastapi import APIRouter, HTTPException
from app.core import database as db

router = APIRouter()


@router.get("/collections")
async def list_collections():
    """
    Lista todas las colecciones de MongoDB con su cantidad de documentos.
    Sirve como vista general del 'explorador de base de datos' en el frontend.
    """
    return await db.list_collections_with_counts()


@router.get("/collections/{name}")
async def get_collection(name: str, page: int = 1, page_size: int = 20):
    """
    Devuelve los documentos paginados de una colección específica,
    ordenados del más reciente al más antiguo.
    """
    if name not in db.KNOWN_COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"Colección '{name}' no existe")
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Parámetros de paginación inválidos")
    return await db.get_collection_documents(name, page=page, page_size=page_size)
