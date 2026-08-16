from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

ORDENES_PATH = (
    ROOT
    / "backend"
    / "data"
    / "raw"
    / "Ordenes.csv"
)

CUSTOMER_KEY = 48597019
SUBSCRIBER_KEY = 200853636


def main():
    print("Leyendo Ordenes.csv...")

    ordenes = pd.read_csv(
        ORDENES_PATH,
        sep=",",
        encoding="utf-8-sig",
        low_memory=False
    )

    # Normalizar llaves
    ordenes["CUSTOMER_KEY"] = pd.to_numeric(
        ordenes["CUSTOMER_KEY"],
        errors="coerce"
    ).astype("Int64")

    ordenes["SUBSCRIBER_KEY"] = pd.to_numeric(
        ordenes["SUBSCRIBER_KEY"],
        errors="coerce"
    ).astype("Int64")

    # Filtrar cliente + servicio
    resultado = ordenes[
        (ordenes["CUSTOMER_KEY"] == CUSTOMER_KEY)
        &
        (ordenes["SUBSCRIBER_KEY"] == SUBSCRIBER_KEY)
    ].copy()

    if resultado.empty:
        print("No se encontraron órdenes para este cliente.")
        return

    print()
    print(
        f"Órdenes encontradas: {len(resultado)}"
    )

    print()
    print("COLUMNAS DISPONIBLES:")
    print()

    for columna in resultado.columns:
        print("-", columna)

    print()
    print("=" * 70)
    print("CONTENIDO COMPLETO DE LAS ÓRDENES")
    print("=" * 70)

    for indice, (_, fila) in enumerate(
        resultado.iterrows(),
        start=1
    ):
        print()
        print(f"ORDEN #{indice}")
        print("-" * 70)

        for columna in resultado.columns:
            valor = fila[columna]

            # No mostramos valores vacíos
            if pd.isna(valor):
                continue

            texto = str(valor).strip()

            if texto == "":
                continue

            print(
                f"{columna}: {texto}"
            )


if __name__ == "__main__":
    main()