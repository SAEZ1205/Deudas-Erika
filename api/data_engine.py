from pathlib import Path
from fastapi import FastAPI, HTTPException, Query

from backend.data_engine.engine import DataEngine

app = FastAPI(title="LucIA Data Engine - Vercel")
_engine = None


def get_engine():
    global _engine

    if _engine is not None:
        return _engine

    root = Path(__file__).resolve().parents[1]
    raw_dir = root / "backend" / "data" / "raw"
    required = [
        raw_dir / "FACTURACION-CLIENTES_.csv",
        raw_dir / "Ordenes.csv",
    ]

    missing = [str(path.name) for path in required if not path.exists()]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=(
                "DataEngine desplegado pero faltan datasets raw en el bundle: "
                + ", ".join(missing)
            ),
        )

    _engine = DataEngine()
    return _engine


@app.get("/api/data_engine")
def analizar_cliente(
    customer_key: int = Query(...),
    subscriber_key: int = Query(...),
):
    try:
        resultado = get_engine().analizar_cliente(
            customer_key=customer_key,
            subscriber_key=subscriber_key,
        )

        if resultado is None:
            raise HTTPException(
                status_code=404,
                detail="No se pudo generar análisis para este cliente.",
            )

        return resultado
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
