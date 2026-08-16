from pathlib import Path
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"


def normalizar_llaves(df):
    for columna in ["CUSTOMER_KEY", "SUBSCRIBER_KEY"]:
        if columna in df.columns:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="coerce"
            ).astype("Int64")

    return df


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

    # ==========================================
    # 1. BUSCAR CARGOS PROPORCIONALES
    # ==========================================

    grupos_prorrateo = [
        "CARGO FIJO PROPORCIONAL",
        "CARGO FIJO PROPORCIONAL VENCIDO"
    ]

    prorrateos = facturacion[
        facturacion["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .isin(grupos_prorrateo)
    ].copy()

    print(
        "Filas de prorrateo encontradas:",
        len(prorrateos)
    )

    # Normalizamos ciclo
    prorrateos["ciclo_str"] = (
        prorrateos["ciclo"]
        .astype(str)
        .str.replace(".0", "", regex=False)
    )

    # ==========================================
    # 2. RESUMIR POR CLIENTE + LINEA + CICLO
    # ==========================================

    resumen = (
        prorrateos
        .groupby(
            [
                "CUSTOMER_KEY",
                "SUBSCRIBER_KEY",
                "ciclo_str"
            ],
            as_index=False
        )
        .agg(
            MONTO_PRORRATEO=(
                "CHARGE_TOTAL_AMOUNT",
                "sum"
            ),
            NUM_CARGOS_PRORRATEO=(
                "CHARGE_TOTAL_AMOUNT",
                "count"
            ),
            FECHA_INICIO_MIN=(
                "PERIOD_START_DATE",
                "min"
            ),
            FECHA_FIN_MAX=(
                "PERIOD_END_DATE",
                "max"
            ),
            FACTURA=(
                "LEGAL_INVOICE_NUMBER",
                lambda s: (
                    s.dropna()
                    .astype(str)
                    .iloc[0]
                    if not s.dropna().empty
                    else ""
                )
            ),
            CONCEPTOS=(
                "CHARGE_CODE_DESC",
                lambda s: " | ".join(
                    sorted(
                        set(
                            s.dropna()
                            .astype(str)
                        )
                    )
                )
            )
        )
    )

    # ==========================================
    # 3. VER SI EXISTE CICLO ANTERIOR
    # ==========================================

    candidatos = []

    for _, fila in resumen.iterrows():

        customer = fila["CUSTOMER_KEY"]
        subscriber = fila["SUBSCRIBER_KEY"]
        ciclo_actual = fila["ciclo_str"]

        fact_cliente = facturacion[
            (facturacion["CUSTOMER_KEY"] == customer)
            &
            (facturacion["SUBSCRIBER_KEY"] == subscriber)
        ].copy()

        if fact_cliente.empty:
            continue

        fact_cliente["ciclo_str"] = (
            fact_cliente["ciclo"]
            .astype(str)
            .str.replace(".0", "", regex=False)
        )

        ciclos_previos = sorted([
            c
            for c in fact_cliente["ciclo_str"]
            .dropna()
            .unique()
            if c < ciclo_actual
        ])

        if not ciclos_previos:
            continue

        ciclo_anterior = ciclos_previos[-1]

        # ======================================
        # 4. BUSCAR ORDENES RELACIONADAS
        # ======================================

        ordenes_cliente = ordenes[
            (ordenes["CUSTOMER_KEY"] == customer)
            &
            (ordenes["SUBSCRIBER_KEY"] == subscriber)
        ].copy()

        motivos = (
            ordenes_cliente[
                "ORDER_ACTION_REASON_DESC"
            ]
            .dropna()
            .astype(str)
            .unique()
            .tolist()
        )

        candidato = fila.to_dict()

        candidato["CICLO_ANTERIOR"] = ciclo_anterior
        candidato["NUM_ORDENES"] = len(
            ordenes_cliente
        )

        candidato["MOTIVOS_ORDEN"] = (
            " | ".join(
                sorted(set(motivos))
            )
        )

        candidatos.append(candidato)

    candidatos = pd.DataFrame(candidatos)

    if candidatos.empty:
        print(
            "No se encontraron candidatos "
            "con ciclo anterior."
        )
        return

    # ==========================================
    # 5. ORDENAR CASOS MÁS SIMPLES
    # ==========================================

    # Nos interesan primero los casos que tengan órdenes,
    # porque necesitamos evidencia del evento que originó el prorrateo.

    candidatos_con_orden = candidatos[
        candidatos["NUM_ORDENES"] > 0
    ].copy()

    candidatos_con_orden = candidatos_con_orden.sort_values(
        by=[
            "NUM_CARGOS_PRORRATEO",
            "NUM_ORDENES"
        ],
        ascending=[
            True,
            True
        ]
    )

    candidatos = candidatos_con_orden

    # ==========================================
    # 6. GUARDAR
    # ==========================================

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    salida = (
        PROCESSED_DIR
        / "proration_candidates.csv"
    )

    candidatos.to_csv(
        salida,
        index=False,
        encoding="utf-8-sig"
    )

    print()
    print(
        "Candidatos con prorrateo + ciclo anterior:",
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
        "CICLO_ANTERIOR",
        "ciclo_str",
        "MONTO_PRORRATEO",
        "NUM_CARGOS_PRORRATEO",
        "NUM_ORDENES",
        "CONCEPTOS"
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