from pathlib import Path
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "data" / "processed"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"


# Cargos que pueden servir para un caso ambiguo.
# Excluimos cargos fijos, prorrateos y reconexiones porque
# esos ya tienen una lógica más clara.
GRUPOS_CANDIDATOS = [
    "PAQUETES",
    "TRAFICO ADICIONAL",
    "CARGA EXTERNA",
    "OTROS",
    "ROAMING"
]


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

    facturacion["ciclo_str"] = (
        facturacion["ciclo"]
        .apply(limpiar_ciclo)
    )

    # --------------------------------------------------
    # 1. BUSCAR CARGOS POTENCIALMENTE AMBIGUOS
    # --------------------------------------------------

    posibles = facturacion[
        facturacion["GRUPO"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .isin(GRUPOS_CANDIDATOS)
    ].copy()

    print(
        "Cargos potencialmente ambiguos encontrados:",
        len(posibles)
    )

    resultados = []

    # --------------------------------------------------
    # 2. ANALIZAR CLIENTE + SERVICIO + CICLO
    # --------------------------------------------------

    grupos = posibles.groupby(
        [
            "CUSTOMER_KEY",
            "SUBSCRIBER_KEY",
            "ciclo_str"
        ]
    )

    for (
        customer_key,
        subscriber_key,
        ciclo_actual
    ), cargos_actuales in grupos:

        if pd.isna(customer_key) or pd.isna(subscriber_key):
            continue

        # Toda la facturación de esa línea
        fact_cliente = facturacion[
            (facturacion["CUSTOMER_KEY"] == customer_key)
            &
            (facturacion["SUBSCRIBER_KEY"] == subscriber_key)
        ].copy()

        ciclos = sorted(
            fact_cliente["ciclo_str"]
            .dropna()
            .unique()
        )

        ciclos_previos = [
            ciclo
            for ciclo in ciclos
            if ciclo < ciclo_actual
        ]

        # Necesitamos recibo anterior
        if not ciclos_previos:
            continue

        ciclo_anterior = ciclos_previos[-1]

        recibo_anterior = fact_cliente[
            fact_cliente["ciclo_str"] == ciclo_anterior
        ].copy()

        recibo_actual = fact_cliente[
            fact_cliente["ciclo_str"] == ciclo_actual
        ].copy()

        # --------------------------------------------------
        # 3. VER QUÉ CONCEPTOS SON NUEVOS
        # --------------------------------------------------

        conceptos_anteriores = set(
            recibo_anterior[
                "CHARGE_CODE_DESC"
            ]
            .dropna()
            .astype(str)
            .str.strip()
        )

        cargos_nuevos = cargos_actuales[
            ~cargos_actuales[
                "CHARGE_CODE_DESC"
            ]
            .fillna("")
            .astype(str)
            .str.strip()
            .isin(conceptos_anteriores)
        ].copy()

        # Si el concepto ya existía antes,
        # no nos sirve como cargo nuevo.
        if cargos_nuevos.empty:
            continue

        # --------------------------------------------------
        # 4. BUSCAR ÓRDENES DEL MISMO CLIENTE + SERVICIO
        # --------------------------------------------------

        ordenes_cliente = ordenes[
            (ordenes["CUSTOMER_KEY"] == customer_key)
            &
            (ordenes["SUBSCRIBER_KEY"] == subscriber_key)
        ].copy()

        # Para el caso NONE priorizamos líneas donde
        # directamente no exista orden que permita
        # explicar el cargo.
        if not ordenes_cliente.empty:
            continue

        # --------------------------------------------------
        # 5. CALCULAR TOTALES
        # --------------------------------------------------

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

        # --------------------------------------------------
        # 6. AGREGAR CARGOS NUEVOS
        # --------------------------------------------------

        for _, cargo in cargos_nuevos.iterrows():

            resultados.append(
                {
                    "CUSTOMER_KEY": customer_key,
                    "SUBSCRIBER_KEY": subscriber_key,

                    "CICLO_ANTERIOR": ciclo_anterior,
                    "CICLO_ACTUAL": ciclo_actual,

                    "TOTAL_ANTERIOR": total_anterior,
                    "TOTAL_ACTUAL": total_actual,
                    "DIFERENCIA": diferencia,

                    "GRUPO": cargo.get("GRUPO"),
                    "CONCEPTO": cargo.get(
                        "CHARGE_CODE_DESC"
                    ),
                    "MONTO_CARGO": cargo.get(
                        "CHARGE_TOTAL_AMOUNT"
                    ),

                    "FACTURA_ACTUAL": cargo.get(
                        "LEGAL_INVOICE_NUMBER"
                    ),

                    "NUM_ORDENES": 0,
                    "EVIDENCE_STATUS": "NONE"
                }
            )

    # --------------------------------------------------
    # 7. GUARDAR RESULTADOS
    # --------------------------------------------------

    candidatos = pd.DataFrame(resultados)

    if candidatos.empty:
        print()
        print(
            "No se encontraron casos candidatos "
            "con evidencia NONE."
        )
        return

    # Preferimos casos simples:
    # un cargo visible y diferencia positiva.
    candidatos = candidatos[
        candidatos["MONTO_CARGO"].notna()
    ].copy()

    candidatos = candidatos.sort_values(
        by=[
            "DIFERENCIA",
            "MONTO_CARGO"
        ],
        ascending=[
            False,
            True
        ]
    )

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    salida = (
        PROCESSED_DIR
        / "unverified_candidates.csv"
    )

    candidatos.to_csv(
        salida,
        index=False,
        encoding="utf-8-sig"
    )

    print()
    print(
        "Casos candidatos NONE:",
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
        "CICLO_ACTUAL",
        "TOTAL_ANTERIOR",
        "TOTAL_ACTUAL",
        "DIFERENCIA",
        "GRUPO",
        "CONCEPTO",
        "MONTO_CARGO",
        "NUM_ORDENES",
        "EVIDENCE_STATUS"
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