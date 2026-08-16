from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.data_engine.engine import DataEngine


app = FastAPI(
    title="LucIA Data Engine API",
    version="1.0.0",
    description=(
        "API determinística para análisis de recibos, "
        "evidencia financiera y clasificación VERIFIED/PARTIAL/NONE."
    )
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ---------------------------------------------------------
# MOTOR
# ---------------------------------------------------------

engine = DataEngine()


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "LucIA Data Engine API",
        "status": "ok"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "loaded"
    }


# ---------------------------------------------------------
# ANÁLISIS DE CLIENTE
# ---------------------------------------------------------

@app.get(
    "/api/analysis/{customer_key}/{subscriber_key}"
)
def analizar_cliente(
    customer_key: int,
    subscriber_key: int
):

    try:
        resultado = engine.analizar_cliente(
            customer_key=customer_key,
            subscriber_key=subscriber_key
        )

        if resultado is None:
            raise HTTPException(
                status_code=404,
                detail="No se pudo generar análisis para este cliente."
            )

        return resultado

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )