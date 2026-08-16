#!/usr/bin/env python3
"""Preprocesa los CSV oficiales descargados del Drive sin exponerlos en GitHub.

Uso:
  python scripts/preparar-dataset.py

Coloca los archivos en backend/data/raw/. El script NO modifica los CSV originales.
Genera backend/data/processed/dataset_summary.json con metadatos y llaves disponibles.
"""
from pathlib import Path
import csv, json

RAW=Path('backend/data/raw'); OUT=Path('backend/data/processed'); OUT.mkdir(parents=True,exist_ok=True)
FILES=['PLANTA CLIENTES.csv','FACTURACION-CLIENTES.csv','Ordenes.csv','NOTAS_CREDITO.csv','CATALOGO-OFERTAS.csv','BRAINY_PRORRATEO_ALTASV3.csv','BRAINY_RECONEXIONESV3.csv','BRAINY_DESCUENTOS_CUOTAS.csv']
KEYS=['COD_CLIENTE','CUSTOMER_KEY','FINANCIAL_ACCOUNT','FINANCIAL_ACCOUNT_KEY','BILLING_ARRANGEMENT_KEY','BillingArrangement','LEGAL_INVOICE_NUMBER','NumeroRecibo','SUBSCRIBER_KEY','NUM_ANEXO','CHARGE_TOTAL_AMOUNT','CHARGE_CODE_DESC','ORDER_ACTION_REASON_DESC','ORDER_ACTION_STATUS_DESC','PERIOD_START_DATE','PERIOD_END_DATE','Monto','Monto_Descuento','suma_prorrateo']

def detect(path):
    raw=path.read_bytes()[:150000]
    for enc in ('utf-8-sig','utf-8','latin-1'):
        try: text=raw.decode(enc); break
        except UnicodeDecodeError: continue
    sample='\n'.join(text.splitlines()[:30])
    try: delim=csv.Sniffer().sniff(sample,delimiters=',;|\t').delimiter
    except: delim=';'
    return enc,delim

def inspect(path):
    enc,delim=detect(path); count=0; headers=[]; examples=[]
    with path.open('r',encoding=enc,newline='',errors='replace') as f:
        r=csv.DictReader(f,delimiter=delim); headers=r.fieldnames or []
        for row in r:
            count+=1
            if len(examples)<2: examples.append({k:row.get(k) for k in headers[:12]})
    return {'file':path.name,'encoding':enc,'delimiter':delim,'rows':count,'columns':headers,'join_keys':[k for k in KEYS if k in headers],'examples':examples}

result={'files':[],'missing':[],'relationship_model':{'PLANTA':'quien y que servicio','FACTURACION':'que se cobro','ORDENES':'que ocurrio','NOTAS_AJUSTES':'que se corrigio','GEMINI':'solo interpreta evidencia estructurada'}}
for name in FILES:
    p=RAW/name
    if p.exists(): result['files'].append(inspect(p))
    else: result['missing'].append(name)
(OUT/'dataset_summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'processed':len(result['files']),'missing':result['missing'],'output':str(OUT/'dataset_summary.json')},ensure_ascii=False,indent=2))
