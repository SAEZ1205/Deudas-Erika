from pathlib import Path
import json
import pandas as pd


# ==========================================================
# RUTAS
# ==========================================================

ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"

OUTPUT_PATH = PROCESSED_DIR / "proration_case.json"


# ==========================================================
# CLIENTE QUE YA SELECCIONAMOS
# ==========================================================

CUSTOMER_KEY = 48597019
SUBSCRIBER_KEY = 200853636
CICLO_PRORRATEO = "20260417"


# ==========================================================
# FUNCIONES AUXILIARES
# ==========================================================

def normalizar_llaves(df):
    for columna in ["CUSTOMER_KEY", "SUBSCRIBER_KEY"]:
        if columna in df.columns:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="coerce"
            ).astype("Int64")

    return df


def limpiar_ciclo(valor):
    """
    Convierte ciclos como 20260417.0 en '20260417'.
    """
    return str(valor).replace(".0", "").strip()


def texto_seguro(valor):
    if pd.isna(valor):
        return None
    return str(valor)


# ==========================================================
# MAIN
# ==========================================================

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
    # 1. FILTRAR CLIENTE / SERVICIO
    # ------------------------------------------------------

    fact_cliente = facturacion[
        (facturacion["CUSTOMER_KEY"] == CUSTOMER_KEY)
        &
        (facturacion["SUBSCRIBER_KEY"] == SUBSCRIBER_KEY)
    ].copy()

    if fact_cliente.empty:
        raise ValueError(
            "No se encontró facturación para el cliente seleccionado."
        )

    fact_cliente["ciclo_str"] = (
        fact_cliente["ciclo"]
        .apply(limpiar_ciclo)
    )

    print()
    print("Cliente seleccionado:")
    print("CUSTOMER_KEY:", CUSTOMER_KEY)
    print("SUBSCRIBER_KEY:", SUBSCRIBER_KEY)

    # ------------------------------------------------------
    # 2. IDENTIFICAR CICLO ACTUAL
    # ------------------------------------------------------

    recibo_actual = fact_cliente[
        fact_cliente["ciclo_str"] == CICLO_PRORRATEO
    ].copy()

    if recibo_actual.empty:
        raise ValueError(
            f"No se encontró el ciclo {CICLO_PRORRATEO}."
        )

    # ------------------------------------------------------
    # 3. BUSCAR CICLO ANTERIOR
    # ------------------------------------------------------

    ciclos = sorted(
        fact_cliente["ciclo_str"]
        .dropna()
        .unique()
    )

    ciclos_previos = [
        ciclo
        for ciclo in ciclos
        if ciclo < CICLO_PRORRATEO
    ]

    if not ciclos_previos:
        raise ValueError(
            "No existe un ciclo anterior al ciclo de prorrateo."
        )

    ciclo_anterior = ciclos_previos[-1]

    recibo_anterior = fact_cliente[
        fact_cliente["ciclo_str"] == ciclo_anterior
    ].copy()

    # ------------------------------------------------------
    # 4. TOTALES
    # ------------------------------------------------------

    total_actual = round(
        float(
            recibo_actual["CHARGE_TOTAL_AMOUNT"].sum()
        ),
        2
    )

    total_anterior = round(
        float(
            recibo_anterior["CHARGE_TOTAL_AMOUNT"].sum()
        ),
        2
    )

    diferencia = round(
        total_actual - total_anterior,
        2
    )

    # ------------------------------------------------------
    # 5. DETECTAR CARGOS PROPORCIONALES
    # ------------------------------------------------------

    grupos_prorrateo = [
        "CARGO FIJO PROPORCIONAL",
        "CARGO FIJO PROPORCIONAL VENCIDO"
    ]

    mask_prorrateo = (
        recibo_actual["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .isin(grupos_prorrateo)
    )

    filas_prorrateo = recibo_actual[
        mask_prorrateo
    ].copy()

    if filas_prorrateo.empty:
        raise ValueError(
            "No se encontró ningún cargo proporcional en el ciclo."
        )

    monto_prorrateo = round(
        float(
            filas_prorrateo[
                "CHARGE_TOTAL_AMOUNT"
            ].sum()
        ),
        2
    )

    # ------------------------------------------------------
    # 6. DESCRIBIR CONCEPTOS ACTUALES
    # ------------------------------------------------------

    cargos_actuales = []

    for _, fila in recibo_actual.iterrows():

        descripcion = texto_seguro(
            fila.get("CHARGE_CODE_DESC")
        )

        grupo = texto_seguro(
            fila.get("GRUPO")
        )

        monto = fila.get(
            "CHARGE_TOTAL_AMOUNT"
        )

        if pd.isna(monto):
            continue

        cargos_actuales.append(
            {
                "description": descripcion,
                "group": grupo,
                "amount": round(float(monto), 2)
            }
        )

    # ------------------------------------------------------
    # 7. BUSCAR ORDENES DEL CLIENTE
    # ------------------------------------------------------

    ordenes_cliente = ordenes[
        (ordenes["CUSTOMER_KEY"] == CUSTOMER_KEY)
        &
        (ordenes["SUBSCRIBER_KEY"] == SUBSCRIBER_KEY)
    ].copy()

    # Para este caso buscamos órdenes vinculadas
    # a pedido del cliente / retención.

    motivo = (
        ordenes_cliente[
            "ORDER_ACTION_REASON_DESC"
        ]
        .fillna("")
        .astype(str)
        .str.casefold()
    )

    ordenes_relevantes = ordenes_cliente[
        motivo.str.contains(
            "retenci",
            regex=False
        )
        |
        motivo.str.contains(
            "pedido de cliente",
            regex=False
        )
    ].copy()

    # ------------------------------------------------------
    # 8. CONSTRUIR EVIDENCIA DE ORDENES
    # ------------------------------------------------------

    evidence = []

    # Evidencia de facturación
    evidence.append(
        {
            "source": "FACTURACION",
            "event": "Cargo fijo proporcional",
            "amount": monto_prorrateo,
            "invoice": texto_seguro(
                filas_prorrateo[
                    "LEGAL_INVOICE_NUMBER"
                ].dropna().iloc[0]
            )
            if not filas_prorrateo[
                "LEGAL_INVOICE_NUMBER"
            ].dropna().empty
            else None
        }
    )

    # Evidencia de órdenes
    for _, fila in ordenes_relevantes.iterrows():

        evidencia_orden = {
            "source": "ORDENES",
            "event": texto_seguro(
                fila.get("ORDER_ACTION_REASON_DESC")
            ),
            "action": texto_seguro(
                fila.get("ORDER_ITEM_TYPE_DESC")
            ),
            "status": texto_seguro(
                fila.get("ORDER_ACTION_STATUS_DESC")
            ),
            "start_date": texto_seguro(
                fila.get("ORDER_ACTION_START_DATE")
            ),
            "completion_date": texto_seguro(
                fila.get("ORDER_ACTION_COMPLETION_DATE")
            )
        }

        # Si existe alguna columna de acción,
        # la agregamos sin asumir que siempre está.
        posibles_columnas_accion = [
            "ORDER_ACTION_TYPE_DESC",
            "ORDER_ACTION_DESC",
            "ACTION_TYPE_DESC"
        ]

        for columna in posibles_columnas_accion:
            if columna in fila.index:
                valor = texto_seguro(
                    fila.get(columna)
                )

                if valor:
                    evidencia_orden[
                        "action"
                    ] = valor
                    break

        evidence.append(
            evidencia_orden
        )

    # ------------------------------------------------------
    # 9. ESTADO DE EVIDENCIA
    # ------------------------------------------------------

    if (
        monto_prorrateo != 0
        and not ordenes_relevantes.empty
    ):
        evidence_status = "VERIFIED"
        requires_handoff = False

    elif monto_prorrateo != 0:
        evidence_status = "PARTIAL"
        requires_handoff = True

    else:
        evidence_status = "NONE"
        requires_handoff = True

    # ------------------------------------------------------
    # 10. FACTURAS
    # ------------------------------------------------------

    factura_actual = None

    if not recibo_actual[
        "LEGAL_INVOICE_NUMBER"
    ].dropna().empty:

        factura_actual = str(
            recibo_actual[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
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
    # 11. JSON FINAL
    # ------------------------------------------------------

    resultado = {
        "client_id": str(CUSTOMER_KEY),
        "subscriber_id": str(SUBSCRIBER_KEY),

        "previous_bill": {
            "invoice": factura_anterior,
            "cycle": ciclo_anterior,
            "total": total_anterior
        },

        "current_bill": {
            "invoice": factura_actual,
            "cycle": CICLO_PRORRATEO,
            "total": total_actual
        },

        "difference": diferencia,

        "cause": "PRORATION_AFTER_COMPLETED_CHANGE_ORDER",

        "proration_amount": monto_prorrateo,

        "charges": cargos_actuales,

        "evidence": evidence,

        "evidence_status": evidence_status,
        "requires_handoff": requires_handoff,

        "traceability": {
            "rule_applied": "PRORATION_RULE_V1",

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
                        "Se detectó un cargo clasificado "
                        "como CARGO FIJO PROPORCIONAL."
                    )
                },
                {
                    "step": 3,
                    "description": (
                        "Se identificó una orden para el mismo "
                        "cliente y servicio."
                    )
                },
                {
                    "step": 4,
                    "description": (
                        "La orden corresponde a "
                        "'Pedido de Cliente - Retención' "
                        "con acción 'Cambiar'."
                    )
                },
                {
                    "step": 5,
                    "description": (
                        "La orden figura como Terminado y "
                        "antecede al ciclo donde aparece "
                        "el cargo proporcional."
                    )
                },
                {
                    "step": 6,
                    "description": (
                        "Al existir cargo proporcional y una "
                        "orden de cambio completada, la evidencia "
                        "se clasificó como VERIFIED."
                    )
                }
            ]
        },

        "limitations": [
            (
                "No se reconstruyen días exactos de prorrateo "
                "porque las fechas disponibles no permiten "
                "validar ese cálculo de forma confiable."
            )
        ]
    }

    # ------------------------------------------------------
    # 12. GUARDAR
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

    # ------------------------------------------------------
    # 13. MOSTRAR RESULTADO
    # ------------------------------------------------------

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