from pathlib import Path
import sys
import json


ROOT = Path(__file__).resolve().parents[2]

sys.path.insert(
    0,
    str(ROOT)
)

from backend.data_engine.engine import DataEngine


engine = DataEngine()


casos = [
    {
        "nombre": "CASO 1",
        "customer_key": 40185997,
        "subscriber_key": 190919663
    },
    {
        "nombre": "CASO 2",
        "customer_key": 48597019,
        "subscriber_key": 200853636
    },
    {
        "nombre": "CASO 3",
        "customer_key": 48425384,
        "subscriber_key": 144739258
    }
]


for caso in casos:

    print()
    print("=" * 70)
    print(caso["nombre"])
    print("=" * 70)

    resultado = engine.analizar_cliente(
        customer_key=caso["customer_key"],
        subscriber_key=caso["subscriber_key"]
    )

    print(
        json.dumps(
            resultado,
            ensure_ascii=False,
            indent=2
        )
    )