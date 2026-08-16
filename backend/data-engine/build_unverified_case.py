from pathlib import Path
import json
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"

OUTPUT_PATH = PROCESSED_DIR / "unverified_case.json"


# ==========================================================
# CASO SELECCIONADO
# ==========================================================

CUSTOMER_KEY = 48425384
SUBSCRIBER_KEY = 144739258
CICLO_ACTUAL = "20260623"


def normalizar_llaves(df):
    for columna in ["CUSTOMER_KEY", "SUBSCRIBER_KEY"]:
        if columna in df.columns:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="coerce"
            ).astype("Int64")

    return df


def limpiar_ciclo(valor):
    return str(valor).replace(".0", "").strip()


def texto_seguro(valor):
    if pd.isna(valor):
        return None
    return str(valor)


def main():

    print("Leyendo datasets...")

    facturacion = pd.read_csv(
        FACTURACION_PATH,
        sep=";",
        encoding="utf-8-sig",
        low_memory=False
    )

    ordenes = pd.read_csv(
        ORDENES_PATH,
        sep=",",
        encoding="utf-8-sig",
        low_memory=False
    )

    facturacion = normalizar_llaves(facturacion)
    ordenes = normalizar_llaves(ordenes)

    # ------------------------------------------------------
    # 1. FILTRAR CLIENTE
    # ------------------------------------------------------

    fact_cliente = facturacion[
        (facturacion["CUSTOMER_KEY"] == CUSTOMER_KEY)
        &
        (facturacion["SUBSCRIBER_KEY"] == SUBSCRIBER_KEY)
    ].copy()

    if fact_cliente.empty:
        raise ValueError(
            "No se encontró facturación para el cliente."
        )

    fact_cliente["ciclo_str"] = (
        fact_cliente["ciclo"]
        .apply(limpiar_ciclo)
    )

    # ------------------------------------------------------
    # 2. RECIBO ACTUAL
    # ------------------------------------------------------

    recibo_actual = fact_cliente[
        fact_cliente["ciclo_str"] == CICLO_ACTUAL
    ].copy()

    if recibo_actual.empty:
        raise ValueError(
            "No se encontró el ciclo actual."
        )

    # ------------------------------------------------------
    # 3. CICLO ANTERIOR
    # ------------------------------------------------------

    ciclos = sorted(
        fact_cliente["ciclo_str"]
        .dropna()
        .unique()
    )

    ciclos_previos = [
        ciclo
        for ciclo in ciclos
        if ciclo < CICLO_ACTUAL
    ]

    if not ciclos_previos:
        raise ValueError(
            "No existe ciclo anterior."
        )

    ciclo_anterior = ciclos_previos[-1]

    recibo_anterior = fact_cliente[
        fact_cliente["ciclo_str"] == ciclo_anterior
    ].copy()

    # ------------------------------------------------------
    # 4. TOTALES
    # ------------------------------------------------------

    total_anterior = round(
        float(
            recibo_anterior[
                "CHARGE_TOTAL_AMOUNT"
            ].sum()
        ),
        2
    )

    total_actual = round(
        float(
            recibo_actual[
                "CHARGE_TOTAL_AMOUNT"
            ].sum()
        ),
        2
    )

    diferencia = round(
        total_actual - total_anterior,
        2
    )

    # ------------------------------------------------------
    # 5. ENCONTRAR CARGOS NUEVOS
    # ------------------------------------------------------

    conceptos_anteriores = set(
        recibo_anterior[
            "CHARGE_CODE_DESC"
        ]
        .dropna()
        .astype(str)
        .str.strip()
    )

    cargos_nuevos = recibo_actual[
        ~recibo_actual[
            "CHARGE_CODE_DESC"
        ]
        .fillna("")
        .astype(str)
        .str.strip()
        .isin(conceptos_anteriores)
    ].copy()

    # Queremos específicamente el paquete
    paquete = cargos_nuevos[
        cargos_nuevos["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .eq("PAQUETES")
    ].copy()

    if paquete.empty:
        raise ValueError(
            "No se encontró el paquete nuevo esperado."
        )

    fila_paquete = paquete.iloc[0]

    monto_paquete = round(
        float(
            fila_paquete[
                "CHARGE_TOTAL_AMOUNT"
            ]
        ),
        2
    )

    descripcion_paquete = texto_seguro(
        fila_paquete[
            "CHARGE_CODE_DESC"
        ]
    )

    factura_actual = texto_seguro(
        fila_paquete[
            "LEGAL_INVOICE_NUMBER"
        ]
    )

    factura_anterior = None

    if not recibo_anterior[
        "LEGAL_INVOICE_NUMBER"
    ].dropna().empty:

        factura_anterior = str(
            recibo_anterior[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
        )

    # ------------------------------------------------------
    # 6. BUSCAR ORDENES
    # ------------------------------------------------------

    ordenes_cliente = ordenes[
        (ordenes["CUSTOMER_KEY"] == CUSTOMER_KEY)
        &
        (ordenes["SUBSCRIBER_KEY"] == SUBSCRIBER_KEY)
    ].copy()

    num_ordenes = len(
        ordenes_cliente
    )

    # ------------------------------------------------------
    # 7. ESTADO DE EVIDENCIA
    # ------------------------------------------------------

    # Sabemos que el cargo existe,
    # pero no existe evidencia suficiente para
    # confirmar cómo se originó.

    if num_ordenes == 0:
        evidence_status = "NONE"
        requires_handoff = True
        cause = None
    else:
        evidence_status = "PARTIAL"
        requires_handoff = True
        cause = None

    # ------------------------------------------------------
    # 8. JSON
    # ------------------------------------------------------

    resultado = {
        "client_id": str(
            CUSTOMER_KEY
        ),

        "subscriber_id": str(
            SUBSCRIBER_KEY
        ),

        "previous_bill": {
            "invoice": factura_anterior,
            "cycle": ciclo_anterior,
            "total": total_anterior
        },

        "current_bill": {
            "invoice": factura_actual,
            "cycle": CICLO_ACTUAL,
            "total": total_actual
        },

        "difference": diferencia,

        "cause": cause,

        "charges": [
            {
                "description": descripcion_paquete,
                "group": "PAQUETES",
                "amount": monto_paquete
            }
        ],

        "evidence": [
            {
                "source": "FACTURACION",
                "event": "Cargo nuevo detectado",
                "description": descripcion_paquete,
                "amount": monto_paquete,
                "invoice": factura_actual
            }
        ],

        "missing_evidence": [
            {
                "source": "ORDENES",
                "description": (
                    "No se encontró una orden asociada "
                    "que permita confirmar el origen "
                    "del paquete."
                )
            }
        ],

        "evidence_status": evidence_status,

        "requires_handoff": requires_handoff,

        "handoff_reason": (
            "EVIDENCIA_INSUFICIENTE_PARA_CONFIRMAR_ORIGEN"
        ),

        "traceability": {
            "rule_applied": "UNVERIFIED_CHARGE_RULE_V1",

            "checked_sources": [
                "FACTURACION",
                "ORDENES"
            ],

            "matched_keys": {
                "customer_key": str(CUSTOMER_KEY),
                "subscriber_key": str(SUBSCRIBER_KEY)
            },

            "steps": [
                {
                    "step": 1,
                    "description": (
                        "Se comparó el recibo actual "
                        "con el recibo anterior."
                    )
                },
                {
                    "step": 2,
                    "description": (
                        "Se detectó un cargo nuevo que no "
                        "aparecía en el ciclo anterior."
                    )
                },
                {
                    "step": 3,
                    "description": (
                        "El cargo nuevo corresponde a un "
                        "paquete de datos por S/9.99."
                    )
                },
                {
                    "step": 4,
                    "description": (
                        "Se buscaron órdenes para el mismo "
                        "cliente y servicio."
                    )
                },
                {
                    "step": 5,
                    "description": (
                        "No se encontró una orden que permita "
                        "confirmar el origen del paquete."
                    )
                },
                {
                    "step": 6,
                    "description": (
                        "Al no existir evidencia suficiente "
                        "para demostrar la causa, el caso se "
                        "clasificó como NONE y requiere hand-off."
                    )
                }
            ],

            "missing_evidence": [
                "Orden asociada a la activación del paquete"
            ]
        }
    }

    # ------------------------------------------------------
    # 9. GUARDAR
    # ------------------------------------------------------

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        OUTPUT_PATH,
        "w",
        encoding="utf-8"
    ) as archivo:

        json.dump(
            resultado,
            archivo,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("Caso generado:")
    print()

    print(
        json.dumps(
            resultado,
            ensure_ascii=False,
            indent=2
        )
    )

    print()
    print(
        "Archivo guardado en:",
        OUTPUT_PATH
    )


if __name__ == "__main__":
    main()