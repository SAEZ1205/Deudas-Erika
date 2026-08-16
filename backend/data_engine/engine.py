from pathlib import Path
import pandas as pd


# ==========================================================
# RUTAS
# ==========================================================

ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = ROOT / "backend" / "data" / "raw"

FACTURACION_PATH = RAW_DIR / "FACTURACION-CLIENTES_.csv"
ORDENES_PATH = RAW_DIR / "Ordenes.csv"


# ==========================================================
# UTILIDADES
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
    return str(valor).replace(".0", "").strip()


def texto_seguro(valor):
    if pd.isna(valor):
        return None

    return str(valor)


# ==========================================================
# MOTOR
# ==========================================================

class DataEngine:

    def __init__(self):
        print("Cargando datasets del motor...")

        self.facturacion = pd.read_csv(
            FACTURACION_PATH,
            sep=";",
            encoding="utf-8-sig",
            low_memory=False
        )

        self.ordenes = pd.read_csv(
            ORDENES_PATH,
            sep=",",
            encoding="utf-8-sig",
            low_memory=False
        )

        self.facturacion = normalizar_llaves(
            self.facturacion
        )

        self.ordenes = normalizar_llaves(
            self.ordenes
        )

        self.facturacion["ciclo_str"] = (
            self.facturacion["ciclo"]
            .apply(limpiar_ciclo)
        )

        print("Datasets cargados correctamente.")

    # ======================================================
    # OBTENER FACTURACIÓN DEL CLIENTE
    # ======================================================

    def obtener_facturacion(
        self,
        customer_key,
        subscriber_key
    ):
        return self.facturacion[
            (
                self.facturacion["CUSTOMER_KEY"]
                == customer_key
            )
            &
            (
                self.facturacion["SUBSCRIBER_KEY"]
                == subscriber_key
            )
        ].copy()

    # ======================================================
    # OBTENER ÓRDENES DEL CLIENTE
    # ======================================================

    def obtener_ordenes(
        self,
        customer_key,
        subscriber_key
    ):
        return self.ordenes[
            (
                self.ordenes["CUSTOMER_KEY"]
                == customer_key
            )
            &
            (
                self.ordenes["SUBSCRIBER_KEY"]
                == subscriber_key
            )
        ].copy()

    # ======================================================
    # REGLA DE RECONEXIÓN
    # ======================================================

    def analizar_reconexion(
        self,
        customer_key,
        subscriber_key
    ):

        fact_cliente = self.obtener_facturacion(
            customer_key,
            subscriber_key
        )

        if fact_cliente.empty:
            return None

        # ----------------------------------------------
        # Buscar cargos por reconexión
        # ----------------------------------------------

        cargos_reconexion = fact_cliente[
            fact_cliente["GRUPO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
            .eq("CARGO POR RECONEXION")
        ].copy()

        if cargos_reconexion.empty:
            return None

        # Tomamos el primer ciclo donde aparece
        ciclo_actual = (
            cargos_reconexion["ciclo_str"]
            .sort_values()
            .iloc[0]
        )

        # ----------------------------------------------
        # Buscar ciclo anterior
        # ----------------------------------------------

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

        if not ciclos_previos:
            return None

        ciclo_anterior = ciclos_previos[-1]

        recibo_actual = fact_cliente[
            fact_cliente["ciclo_str"]
            == ciclo_actual
        ].copy()

        recibo_anterior = fact_cliente[
            fact_cliente["ciclo_str"]
            == ciclo_anterior
        ].copy()

        # ----------------------------------------------
        # Totales
        # ----------------------------------------------

        total_actual = round(
            float(
                recibo_actual[
                    "CHARGE_TOTAL_AMOUNT"
                ].sum()
            ),
            2
        )

        total_anterior = round(
            float(
                recibo_anterior[
                    "CHARGE_TOTAL_AMOUNT"
                ].sum()
            ),
            2
        )

        diferencia = round(
            total_actual - total_anterior,
            2
        )

        monto_reconexion = round(
            float(
                recibo_actual[
                    recibo_actual["GRUPO"]
                    .fillna("")
                    .astype(str)
                    .str.strip()
                    .str.upper()
                    .eq("CARGO POR RECONEXION")
                ]["CHARGE_TOTAL_AMOUNT"].sum()
            ),
            2
        )

        # ----------------------------------------------
        # Facturas
        # ----------------------------------------------

        factura_actual = texto_seguro(
            recibo_actual[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
        )

        factura_anterior = texto_seguro(
            recibo_anterior[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
        )

        # ----------------------------------------------
        # Buscar órdenes
        # ----------------------------------------------

        ordenes_cliente = self.obtener_ordenes(
            customer_key,
            subscriber_key
        )

        motivo = (
            ordenes_cliente[
                "ORDER_ACTION_REASON_DESC"
            ]
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

        # ----------------------------------------------
        # Evidencia
        # ----------------------------------------------

        evidence = [
            {
                "source": "FACTURACION",
                "event": "Cargo por Reconexión",
                "amount": monto_reconexion,
                "invoice": factura_actual
            }
        ]

        if not suspensiones.empty:
            fila = suspensiones.iloc[0]

            evidence.append(
                {
                    "source": "ORDENES",
                    "event": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_REASON_DESC"
                        )
                    ),
                    "status": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_STATUS_DESC"
                        )
                    ),
                    "start_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_START_DATE"
                        )
                    ),
                    "completion_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_COMPLETION_DATE"
                        )
                    )
                }
            )

        if not reactivaciones.empty:
            fila = reactivaciones.iloc[0]

            evidence.append(
                {
                    "source": "ORDENES",
                    "event": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_REASON_DESC"
                        )
                    ),
                    "status": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_STATUS_DESC"
                        )
                    ),
                    "start_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_START_DATE"
                        )
                    ),
                    "completion_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_COMPLETION_DATE"
                        )
                    )
                }
            )

        # ----------------------------------------------
        # Evaluar evidencia
        # ----------------------------------------------

        if (
            monto_reconexion != 0
            and not suspensiones.empty
            and not reactivaciones.empty
        ):
            evidence_status = "VERIFIED"
            requires_handoff = False

        elif monto_reconexion != 0:
            evidence_status = "PARTIAL"
            requires_handoff = True

        else:
            evidence_status = "NONE"
            requires_handoff = True

        # ----------------------------------------------
        # Resultado estándar
        # ----------------------------------------------

        return {
            "client_id": str(customer_key),
            "subscriber_id": str(
                subscriber_key
            ),

            "scenario": "RECONNECTION",

            "previous_bill": {
                "invoice": factura_anterior,
                "cycle": ciclo_anterior,
                "total": total_anterior
            },

            "current_bill": {
                "invoice": factura_actual,
                "cycle": ciclo_actual,
                "total": total_actual
            },

            "difference": diferencia,

            "cause": "RECONNECTION",

            "charges": [
                {
                    "description":
                        "Cargo por Reconexión",
                    "amount":
                        monto_reconexion
                }
            ],

            "evidence": evidence,

            "evidence_status":
                evidence_status,

            "requires_handoff":
                requires_handoff,

            "traceability": {
                "rule_applied":
                    "RECONNECTION_RULE_V1",

                "checked_sources": [
                    "FACTURACION",
                    "ORDENES"
                ],

                "matched_keys": {
                    "customer_key":
                        str(customer_key),

                    "subscriber_key":
                        str(subscriber_key)
                }
            }
        }

    # ======================================================
    # REGLA DE PRORRATEO
    # ======================================================

    def analizar_prorrateo(
        self,
        customer_key,
        subscriber_key
    ):

        fact_cliente = self.obtener_facturacion(
            customer_key,
            subscriber_key
        )

        if fact_cliente.empty:
            return None

        # ----------------------------------------------
        # Buscar cargos proporcionales
        # ----------------------------------------------

        grupos_prorrateo = [
            "CARGO FIJO PROPORCIONAL",
            "CARGO FIJO PROPORCIONAL VENCIDO"
        ]

        cargos_prorrateo = fact_cliente[
            fact_cliente["GRUPO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
            .isin(grupos_prorrateo)
        ].copy()

        if cargos_prorrateo.empty:
            return None

        # Tomamos el primer ciclo con prorrateo
        ciclo_actual = (
            cargos_prorrateo["ciclo_str"]
            .sort_values()
            .iloc[0]
        )

        # ----------------------------------------------
        # Buscar ciclo anterior
        # ----------------------------------------------

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

        if not ciclos_previos:
            return None

        ciclo_anterior = ciclos_previos[-1]

        recibo_actual = fact_cliente[
            fact_cliente["ciclo_str"]
            == ciclo_actual
        ].copy()

        recibo_anterior = fact_cliente[
            fact_cliente["ciclo_str"]
            == ciclo_anterior
        ].copy()

        # ----------------------------------------------
        # Totales
        # ----------------------------------------------

        total_actual = round(
            float(
                recibo_actual[
                    "CHARGE_TOTAL_AMOUNT"
                ].sum()
            ),
            2
        )

        total_anterior = round(
            float(
                recibo_anterior[
                    "CHARGE_TOTAL_AMOUNT"
                ].sum()
            ),
            2
        )

        diferencia = round(
            total_actual - total_anterior,
            2
        )

        filas_prorrateo = recibo_actual[
            recibo_actual["GRUPO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
            .isin(grupos_prorrateo)
        ].copy()

        monto_prorrateo = round(
            float(
                filas_prorrateo[
                    "CHARGE_TOTAL_AMOUNT"
                ].sum()
            ),
            2
        )

        # ----------------------------------------------
        # Facturas
        # ----------------------------------------------

        factura_actual = texto_seguro(
            recibo_actual[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
        )

        factura_anterior = texto_seguro(
            recibo_anterior[
                "LEGAL_INVOICE_NUMBER"
            ]
            .dropna()
            .iloc[0]
        )

        # ----------------------------------------------
        # Cargos actuales
        # ----------------------------------------------

        charges = []

        for _, fila in recibo_actual.iterrows():

            monto = fila.get(
                "CHARGE_TOTAL_AMOUNT"
            )

            if pd.isna(monto):
                continue

            charges.append(
                {
                    "description": texto_seguro(
                        fila.get(
                            "CHARGE_CODE_DESC"
                        )
                    ),
                    "group": texto_seguro(
                        fila.get("GRUPO")
                    ),
                    "amount": round(
                        float(monto),
                        2
                    )
                }
            )

        # ----------------------------------------------
        # Buscar órdenes
        # ----------------------------------------------

        ordenes_cliente = self.obtener_ordenes(
            customer_key,
            subscriber_key
        )

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

        # ----------------------------------------------
        # Evidencia
        # ----------------------------------------------

        evidence = [
            {
                "source": "FACTURACION",
                "event": "Cargo fijo proporcional",
                "amount": monto_prorrateo,
                "invoice": factura_actual
            }
        ]

        for _, fila in ordenes_relevantes.iterrows():

            evidence.append(
                {
                    "source": "ORDENES",
                    "event": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_REASON_DESC"
                        )
                    ),
                    "action": texto_seguro(
                        fila.get(
                            "ORDER_ITEM_TYPE_DESC"
                        )
                    ),
                    "status": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_STATUS_DESC"
                        )
                    ),
                    "start_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_START_DATE"
                        )
                    ),
                    "completion_date": texto_seguro(
                        fila.get(
                            "ORDER_ACTION_COMPLETION_DATE"
                        )
                    )
                }
            )

        # ----------------------------------------------
        # Evaluar evidencia
        # ----------------------------------------------

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

        # ----------------------------------------------
        # Resultado estándar
        # ----------------------------------------------

        return {
            "client_id": str(customer_key),
            "subscriber_id": str(
                subscriber_key
            ),

            "scenario": "PRORATION",

            "previous_bill": {
                "invoice": factura_anterior,
                "cycle": ciclo_anterior,
                "total": total_anterior
            },

            "current_bill": {
                "invoice": factura_actual,
                "cycle": ciclo_actual,
                "total": total_actual
            },

            "difference": diferencia,

            "cause":
                "PRORATION_AFTER_COMPLETED_CHANGE_ORDER",

            "proration_amount":
                monto_prorrateo,

            "charges":
                charges,

            "evidence":
                evidence,

            "evidence_status":
                evidence_status,

            "requires_handoff":
                requires_handoff,

            "traceability": {
                "rule_applied":
                    "PRORATION_RULE_V1",

                "checked_sources": [
                    "FACTURACION",
                    "ORDENES"
                ],

                "matched_keys": {
                    "customer_key":
                        str(customer_key),

                    "subscriber_key":
                        str(subscriber_key)
                }
            },

            "limitations": [
                (
                    "No se reconstruyen días exactos "
                    "de prorrateo porque las fechas "
                    "disponibles no permiten validar "
                    "ese cálculo de forma confiable."
                )
            ]
        }

    # ======================================================
    # REGLA DE CARGO NO VERIFICABLE
    # ======================================================

    def analizar_cargo_no_verificable(
        self,
        customer_key,
        subscriber_key
    ):

        fact_cliente = self.obtener_facturacion(
            customer_key,
            subscriber_key
        )

        if fact_cliente.empty:
            return None

        # Tomamos los ciclos ordenados
        ciclos = sorted(
            fact_cliente["ciclo_str"]
            .dropna()
            .unique()
        )

        if len(ciclos) < 2:
            return None

        # Revisamos cada ciclo a partir del segundo
        for ciclo_actual in ciclos[1:]:

            ciclos_previos = [
                ciclo
                for ciclo in ciclos
                if ciclo < ciclo_actual
            ]

            if not ciclos_previos:
                continue

            ciclo_anterior = ciclos_previos[-1]

            recibo_actual = fact_cliente[
                fact_cliente["ciclo_str"]
                == ciclo_actual
            ].copy()

            recibo_anterior = fact_cliente[
                fact_cliente["ciclo_str"]
                == ciclo_anterior
            ].copy()

            # ------------------------------------------
            # Conceptos anteriores
            # ------------------------------------------

            conceptos_anteriores = set(
                recibo_anterior[
                    "CHARGE_CODE_DESC"
                ]
                .dropna()
                .astype(str)
                .str.strip()
            )

            # ------------------------------------------
            # Buscar cargos nuevos
            # ------------------------------------------

            cargos_nuevos = recibo_actual[
                ~recibo_actual[
                    "CHARGE_CODE_DESC"
                ]
                .fillna("")
                .astype(str)
                .str.strip()
                .isin(conceptos_anteriores)
            ].copy()

            if cargos_nuevos.empty:
                continue

            # Para este escenario nos interesan
            # paquetes/cargos adicionales
            cargos_candidatos = cargos_nuevos[
                cargos_nuevos["GRUPO"]
                .fillna("")
                .astype(str)
                .str.strip()
                .str.upper()
                .isin(
                    [
                        "PAQUETES",
                        "TRAFICO ADICIONAL",
                        "ROAMING",
                        "OTROS",
                        "CARGA EXTERNA"
                    ]
                )
            ].copy()

            if cargos_candidatos.empty:
                continue

            # ------------------------------------------
            # Buscar órdenes
            # ------------------------------------------

            ordenes_cliente = self.obtener_ordenes(
                customer_key,
                subscriber_key
            )

            # Queremos un caso sin orden que explique
            # el origen del cargo.
            if not ordenes_cliente.empty:
                continue

            # Tomamos el primer cargo candidato
            fila_cargo = cargos_candidatos.iloc[0]

            monto_cargo = round(
                float(
                    fila_cargo[
                        "CHARGE_TOTAL_AMOUNT"
                    ]
                ),
                2
            )

            descripcion = texto_seguro(
                fila_cargo.get(
                    "CHARGE_CODE_DESC"
                )
            )

            grupo = texto_seguro(
                fila_cargo.get("GRUPO")
            )

            factura_actual = texto_seguro(
                fila_cargo.get(
                    "LEGAL_INVOICE_NUMBER"
                )
            )

            factura_anterior = None

            if not recibo_anterior[
                "LEGAL_INVOICE_NUMBER"
            ].dropna().empty:

                factura_anterior = texto_seguro(
                    recibo_anterior[
                        "LEGAL_INVOICE_NUMBER"
                    ]
                    .dropna()
                    .iloc[0]
                )

            # ------------------------------------------
            # Totales
            # ------------------------------------------

            total_actual = round(
                float(
                    recibo_actual[
                        "CHARGE_TOTAL_AMOUNT"
                    ].sum()
                ),
                2
            )

            total_anterior = round(
                float(
                    recibo_anterior[
                        "CHARGE_TOTAL_AMOUNT"
                    ].sum()
                ),
                2
            )

            diferencia = round(
                total_actual - total_anterior,
                2
            )

            # ------------------------------------------
            # Resultado
            # ------------------------------------------

            return {
                "client_id": str(customer_key),
                "subscriber_id": str(
                    subscriber_key
                ),

                "scenario": "UNVERIFIED_CHARGE",

                "previous_bill": {
                    "invoice": factura_anterior,
                    "cycle": ciclo_anterior,
                    "total": total_anterior
                },

                "current_bill": {
                    "invoice": factura_actual,
                    "cycle": ciclo_actual,
                    "total": total_actual
                },

                "difference": diferencia,

                "cause": None,

                "charges": [
                    {
                        "description": descripcion,
                        "group": grupo,
                        "amount": monto_cargo
                    }
                ],

                "evidence": [
                    {
                        "source": "FACTURACION",
                        "event":
                            "Cargo nuevo detectado",
                        "description":
                            descripcion,
                        "amount":
                            monto_cargo,
                        "invoice":
                            factura_actual
                    }
                ],

                "missing_evidence": [
                    {
                        "source": "ORDENES",
                        "description": (
                            "No se encontró una orden "
                            "asociada que permita "
                            "confirmar el origen del cargo."
                        )
                    }
                ],

                "evidence_status": "NONE",

                "requires_handoff": True,

                "handoff_reason": (
                    "EVIDENCIA_INSUFICIENTE_"
                    "PARA_CONFIRMAR_ORIGEN"
                ),

                "traceability": {
                    "rule_applied":
                        "UNVERIFIED_CHARGE_RULE_V1",

                    "checked_sources": [
                        "FACTURACION",
                        "ORDENES"
                    ],

                    "matched_keys": {
                        "customer_key":
                            str(customer_key),

                        "subscriber_key":
                            str(subscriber_key)
                    }
                }
            }

        return None

    # ======================================================
    # ANALISIS GENERAL DEL CLIENTE
    # ======================================================

    def analizar_cliente(
        self,
        customer_key,
        subscriber_key
    ):

        # --------------------------------------------------
        # 1. Intentar detectar reconexión
        # --------------------------------------------------

        resultado = self.analizar_reconexion(
            customer_key,
            subscriber_key
        )

        if resultado is not None:
            return resultado

        # --------------------------------------------------
        # 2. Intentar detectar prorrateo
        # --------------------------------------------------

        resultado = self.analizar_prorrateo(
            customer_key,
            subscriber_key
        )

        if resultado is not None:
            return resultado

        # --------------------------------------------------
        # 3. Intentar detectar cargo no verificable
        # --------------------------------------------------

        resultado = self.analizar_cargo_no_verificable(
            customer_key,
            subscriber_key
        )

        if resultado is not None:
            return resultado

        # --------------------------------------------------
        # 4. No se detectó un escenario relevante
        # --------------------------------------------------

        fact_cliente = self.obtener_facturacion(
            customer_key,
            subscriber_key
        )

        if fact_cliente.empty:
            return {
                "client_id": str(customer_key),
                "subscriber_id": str(subscriber_key),
                "scenario": "CLIENT_NOT_FOUND",
                "cause": None,
                "evidence": [],
                "evidence_status": "NONE",
                "requires_handoff": True,
                "handoff_reason": "CLIENT_NOT_FOUND"
            }

        return {
            "client_id": str(customer_key),
            "subscriber_id": str(subscriber_key),

            "scenario": "NO_RELEVANT_CHANGE",

            "cause": None,

            "evidence": [],

            "evidence_status": "NONE",

            "requires_handoff": False,

            "traceability": {
                "rule_applied": "NO_RELEVANT_CHANGE_RULE_V1",

                "checked_rules": [
                    "RECONNECTION_RULE_V1",
                    "PRORATION_RULE_V1",
                    "UNVERIFIED_CHARGE_RULE_V1"
                ],

                "matched_keys": {
                    "customer_key": str(customer_key),
                    "subscriber_key": str(subscriber_key)
                }
            }
        }