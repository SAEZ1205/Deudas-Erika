from pathlib import Path
import pandas as pd


# =========================
# RUTAS DEL PROYECTO
# =========================

ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"


# =========================
# FUNCIONES AUXILIARES
# =========================

def normalizar_llaves(df):
    """
    Normaliza las columnas que usaremos para relacionar
    facturación y órdenes.
    """

    for columna in ["CUSTOMER_KEY", "SUBSCRIBER_KEY"]:
        if columna in df.columns:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="coerce"
            ).astype("Int64")

    return df


def cargar_datasets():
    """
    Carga solamente los dos datasets necesarios
    para detectar casos de reconexión.
    """

    print("Leyendo FACTURACION-CLIENTES_.csv...")

    facturacion = pd.read_csv(
        FACTURACION_PATH,
        sep=";",
        encoding="utf-8-sig",
        low_memory=False
    )

    print("Leyendo Ordenes.csv...")

    ordenes = pd.read_csv(
        ORDENES_PATH,
        sep=",",
        encoding="utf-8-sig",
        low_memory=False
    )

    facturacion = normalizar_llaves(facturacion)
    ordenes = normalizar_llaves(ordenes)

    return facturacion, ordenes


# =========================
# LÓGICA PRINCIPAL
# =========================

def buscar_reconexiones(facturacion, ordenes):

    # 1. Encontramos cargos por reconexión en facturación

    cargos_reconexion = facturacion[
        facturacion["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .eq("CARGO POR RECONEXION")
    ].copy()

    print()
    print(
        "Cargos por reconexión encontrados:",
        len(cargos_reconexion)
    )

    # 2. Obtenemos los clientes/líneas involucrados

    clientes_con_reconexion = (
        cargos_reconexion[
            [
                "CUSTOMER_KEY",
                "SUBSCRIBER_KEY"
            ]
        ]
        .dropna()
        .drop_duplicates()
    )

    # 3. Buscamos todas sus órdenes

    ordenes_relacionadas = ordenes.merge(
        clientes_con_reconexion,
        on=[
            "CUSTOMER_KEY",
            "SUBSCRIBER_KEY"
        ],
        how="inner"
    )

    # 4. Normalizamos la descripción de la orden

    motivo = (
        ordenes_relacionadas[
            "ORDER_ACTION_REASON_DESC"
        ]
        .fillna("")
        .astype(str)
        .str.casefold()
    )

    # 5. Detectamos suspensión y reactivación

    ordenes_relacionadas["ES_SUSPENSION"] = (
        motivo.str.contains(
            "suspensi",
            regex=False
        )
    )

    ordenes_relacionadas["ES_REACTIVACION"] = (
        motivo.str.contains(
            "reactivaci",
            regex=False
        )
    )

    # 6. Resumimos evidencia por cliente + línea

    evidencia = (
        ordenes_relacionadas
        .groupby(
            [
                "CUSTOMER_KEY",
                "SUBSCRIBER_KEY"
            ],
            as_index=False
        )
        .agg(
            TIENE_SUSPENSION=(
                "ES_SUSPENSION",
                "max"
            ),
            TIENE_REACTIVACION=(
                "ES_REACTIVACION",
                "max"
            ),
            NUM_ORDENES=(
                "ORDER_ACTION_REASON_DESC",
                "count"
            )
        )
    )

    # 7. Solo dejamos casos con ambas evidencias

    candidatos = evidencia[
        evidencia["TIENE_SUSPENSION"]
        &
        evidencia["TIENE_REACTIVACION"]
    ].copy()

    # 8. Agregamos datos del cargo

    resumen_cargos = (
        cargos_reconexion
        .groupby(
            [
                "CUSTOMER_KEY",
                "SUBSCRIBER_KEY"
            ],
            as_index=False
        )
        .agg(
            NUM_CARGOS_RECONEXION=(
                "CHARGE_TOTAL_AMOUNT",
                "count"
            ),
            MONTO_RECONEXION=(
                "CHARGE_TOTAL_AMOUNT",
                "sum"
            ),
            FACTURAS=(
                "LEGAL_INVOICE_NUMBER",
                lambda valores: " | ".join(
                    sorted(
                        set(
                            valores
                            .dropna()
                            .astype(str)
                        )
                    )
                )
            )
        )
    )

    candidatos = candidatos.merge(
        resumen_cargos,
        on=[
            "CUSTOMER_KEY",
            "SUBSCRIBER_KEY"
        ],
        how="left"
    )

    # 9. Ordenamos para ver primero casos sencillos

    candidatos = candidatos.sort_values(
        by=[
            "NUM_CARGOS_RECONEXION",
            "NUM_ORDENES"
        ],
        ascending=[
            True,
            True
        ]
    )

    return candidatos


def guardar_resultados(candidatos):

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    salida = (
        PROCESSED_DIR
        / "reconnection_candidates.csv"
    )

    candidatos.to_csv(
        salida,
        index=False,
        encoding="utf-8-sig"
    )

    return salida


def main():

    facturacion, ordenes = cargar_datasets()

    candidatos = buscar_reconexiones(
        facturacion,
        ordenes
    )

    salida = guardar_resultados(
        candidatos
    )

    print()
    print(
        "Casos con cargo + suspensión + reactivación:",
        len(candidatos)
    )

    print()
    print(
        "Archivo generado:",
        salida
    )

    print()
    print("Primeros 10 candidatos:")

    columnas = [
        "CUSTOMER_KEY",
        "SUBSCRIBER_KEY",
        "MONTO_RECONEXION",
        "NUM_CARGOS_RECONEXION",
        "NUM_ORDENES",
        "FACTURAS"
    ]

    print(
        candidatos[
            columnas
        ]
        .head(10)
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()