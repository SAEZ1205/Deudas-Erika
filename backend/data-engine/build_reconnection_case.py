from pathlib import Path
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"
CANDIDATOS_PATH = PROCESSED_DIR / "reconnection_candidates.csv"

OUTPUT_PATH = PROCESSED_DIR / "reconnection_case.json"


def normalizar_llaves(df):
    for columna in ["CUSTOMER_KEY", "SUBSCRIBER_KEY"]:
        if columna in df.columns:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="coerce"
            ).astype("Int64")
    return df

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

    candidatos = pd.read_csv(
        CANDIDATOS_PATH,
        encoding="utf-8-sig"
    )

    facturacion = normalizar_llaves(facturacion)
    ordenes = normalizar_llaves(ordenes)
    candidatos = normalizar_llaves(candidatos)

    candidato = None

    for _, fila in candidatos.iterrows():
        customer_key_test = fila["CUSTOMER_KEY"]
        subscriber_key_test = fila["SUBSCRIBER_KEY"]

        fact_test = facturacion[
            (facturacion["CUSTOMER_KEY"] == customer_key_test)
            &
            (facturacion["SUBSCRIBER_KEY"] == subscriber_key_test)
        ].copy()

        if fact_test.empty:
            continue

        fact_test["ciclo_str"] = (
            fact_test["ciclo"]
            .astype(str)
            .str.replace(".0", "", regex=False)
        )

        reconexion_test = fact_test[
            fact_test["GRUPO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
            .eq("CARGO POR RECONEXION")
        ].copy()

        if reconexion_test.empty:
            continue

        ciclo_reconexion = (
            reconexion_test["ciclo_str"]
            .sort_values()
            .iloc[0]
        )

        ciclos_previos = sorted([
            c for c in fact_test["ciclo_str"].dropna().unique()
            if c < ciclo_reconexion
        ])

        if ciclos_previos:
            candidato = fila
            break

    if candidato is None:
        raise ValueError(
            "No se encontró ningún candidato con ciclo anterior."
        )

    customer_key = candidato["CUSTOMER_KEY"]
    subscriber_key = candidato["SUBSCRIBER_KEY"]

    print()
    print("Cliente seleccionado:")
    print("CUSTOMER_KEY:", customer_key)
    print("SUBSCRIBER_KEY:", subscriber_key)

    # --------------------------------------------------
    # FACTURACIÓN DEL CLIENTE
    # --------------------------------------------------

    fact_cliente = facturacion[
        (facturacion["CUSTOMER_KEY"] == customer_key)
        &
        (facturacion["SUBSCRIBER_KEY"] == subscriber_key)
    ].copy()

    if fact_cliente.empty:
        raise ValueError("No se encontró facturación para el candidato.")

    # Convertimos ciclo a texto para ordenar
    fact_cliente["ciclo_str"] = (
        fact_cliente["ciclo"]
        .astype(str)
        .str.replace(".0", "", regex=False)
    )

    ciclos = sorted(
        fact_cliente["ciclo_str"]
        .dropna()
        .unique()
    )

    if len(ciclos) < 2:
        raise ValueError(
            "El cliente no tiene suficientes ciclos para comparar."
        )

    # Buscamos el ciclo donde aparece reconexión
    reconexion_rows = fact_cliente[
        fact_cliente["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .eq("CARGO POR RECONEXION")
    ].copy()

    if reconexion_rows.empty:
        raise ValueError(
            "El candidato no tiene cargo por reconexión."
        )

    ciclo_actual = (
        reconexion_rows["ciclo_str"]
        .sort_values()
        .iloc[0]
    )

    ciclos_previos = [
        c for c in ciclos
        if c < ciclo_actual
    ]

    if not ciclos_previos:
        raise ValueError(
            "No existe un ciclo anterior al de reconexión."
        )

    ciclo_anterior = ciclos_previos[-1]

    recibo_actual = fact_cliente[
        fact_cliente["ciclo_str"] == ciclo_actual
    ].copy()

    recibo_anterior = fact_cliente[
        fact_cliente["ciclo_str"] == ciclo_anterior
    ].copy()

    total_actual = float(
        recibo_actual["CHARGE_TOTAL_AMOUNT"].sum()
    )

    total_anterior = float(
        recibo_anterior["CHARGE_TOTAL_AMOUNT"].sum()
    )

    diferencia = round(
        total_actual - total_anterior,
        2
    )

    monto_reconexion = float(
        recibo_actual[
            recibo_actual["GRUPO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
            .eq("CARGO POR RECONEXION")
        ]["CHARGE_TOTAL_AMOUNT"].sum()
    )

    factura_actual = (
        recibo_actual["LEGAL_INVOICE_NUMBER"]
        .dropna()
        .astype(str)
        .iloc[0]
    )

    factura_anterior = (
        recibo_anterior["LEGAL_INVOICE_NUMBER"]
        .dropna()
        .astype(str)
        .iloc[0]
    )

    # --------------------------------------------------
    # ÓRDENES
    # --------------------------------------------------

    ordenes_cliente = ordenes[
        (ordenes["CUSTOMER_KEY"] == customer_key)
        &
        (ordenes["SUBSCRIBER_KEY"] == subscriber_key)
    ].copy()

    motivo = (
        ordenes_cliente["ORDER_ACTION_REASON_DESC"]
        .fillna("")
        .astype(str)
        .str.casefold()
    )

    suspensiones = ordenes_cliente[
        motivo.str.contains(
            "suspensi",
            regex=False
        )
    ].copy()

    reactivaciones = ordenes_cliente[
        motivo.str.contains(
            "reactivaci",
            regex=False
        )
    ].copy()

    # Tomamos una evidencia representativa
    suspension = None

    if not suspensiones.empty:
        fila = suspensiones.iloc[0]

        suspension = {
            "source": "ORDENES",
            "event": texto_seguro(
                fila.get("ORDER_ACTION_REASON_DESC")
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


    reactivacion = None

    if not reactivaciones.empty:
        fila = reactivaciones.iloc[0]

        reactivacion = {
            "source": "ORDENES",
            "event": texto_seguro(
                fila.get("ORDER_ACTION_REASON_DESC")
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

    # --------------------------------------------------
    # ESTADO DE EVIDENCIA
    # --------------------------------------------------

    if (
        monto_reconexion != 0
        and suspension
        and reactivacion
    ):
        evidence_status = "VERIFIED"
        requires_handoff = False

    elif monto_reconexion != 0:
        evidence_status = "PARTIAL"
        requires_handoff = True

    else:
        evidence_status = "NONE"
        requires_handoff = True

    # --------------------------------------------------
    # JSON FINAL
    # --------------------------------------------------

    resultado = {
        "client_id": str(customer_key),
        "subscriber_id": str(subscriber_key),

        "previous_bill": {
            "invoice": factura_anterior,
            "cycle": ciclo_anterior,
            "total": round(total_anterior, 2)
        },

        "current_bill": {
            "invoice": factura_actual,
            "cycle": ciclo_actual,
            "total": round(total_actual, 2)
        },

        "difference": diferencia,

        "cause": "RECONNECTION",

        "charges": [
            {
                "description": "Cargo por Reconexión",
                "amount": round(
                    monto_reconexion,
                    2
                )
            }
        ],

        "evidence": [
            {
                "source": "FACTURACION",
                "event": "Cargo por Reconexión",
                "amount": round(
                    monto_reconexion,
                    2
                ),
                "invoice": factura_actual
            }
        ],

        "evidence_status": evidence_status,
        "requires_handoff": requires_handoff,

        "traceability": {
            "rule_applied": "RECONNECTION_RULE_V1",

            "checked_sources": [
                "FACTURACION",
                "ORDENES"
            ],

            "matched_keys": {
                "customer_key": str(customer_key),
                "subscriber_key": str(subscriber_key)
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
                        "como CARGO POR RECONEXION."
                    )
                },
                {
                    "step": 3,
                    "description": (
                        "Se buscó una suspensión para "
                        "el mismo cliente y servicio."
                    )
                },
                {
                    "step": 4,
                    "description": (
                        "Se buscó una reactivación con cargo "
                        "para el mismo cliente y servicio."
                    )
                },
                {
                    "step": 5,
                    "description": (
                        "Al existir cargo, suspensión y "
                        "reactivación, la evidencia se "
                        "clasificó como VERIFIED."
                    )
                }
            ]
        }
    }

    if suspension:
        resultado["evidence"].append(
            suspension
        )

    if reactivacion:
        resultado["evidence"].append(
            reactivacion
        )

    with open(
        OUTPUT_PATH,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            resultado,
            f,
            indent=2,
            ensure_ascii=False
        )

    print()
    print("Caso generado:")
    print(json.dumps(
        resultado,
        indent=2,
        ensure_ascii=False
    ))

    print()
    print(
        "Guardado en:",
        OUTPUT_PATH
    )


if __name__ == "__main__":
    main()