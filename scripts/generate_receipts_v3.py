from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'recibos'
OUT.mkdir(exist_ok=True)

BLUE = colors.HexColor('#0B5AA6')
BLUE2 = colors.HexColor('#0078C8')
NAVY = colors.HexColor('#102A4C')
GRAY = colors.HexColor('#667C93')
LINE = colors.HexColor('#D8E5EE')
GREEN = colors.HexColor('#00A36C')
WHITE = colors.white

months = [
    ('marzo', '01 mar 2026 - 31 mar 2026', '05 abr 2026', '15 abr 2026'),
    ('abril', '01 abr 2026 - 30 abr 2026', '05 may 2026', '15 may 2026'),
    ('mayo', '01 may 2026 - 31 may 2026', '05 jun 2026', '15 jun 2026'),
    ('junio', '01 jun 2026 - 30 jun 2026', '05 jul 2026', '15 jul 2026'),
    ('julio', '01 jul 2026 - 15 jul 2026', '20 jul 2026', '31 jul 2026'),
    ('agosto', '16 jul 2026 - 15 ago 2026', '10 ago 2026', '15 ago 2026'),
]

scenarios = {
    'current': {
        'client':'María Fernanda López Rojas', 'line':'987 654 321', 'account':'000987654321',
        'special_total':59.90, 'usage':22.6,
        'lines':[('Plan Móvil 40 GB','S/59.90')],
        'what':'Tu recibo se mantuvo igual. Solo se te cobró el Plan Móvil 40 GB. El precio del plan no cambió.',
        'evidence':'Detalle del recibo y plan vigente.',
    },
    'proration': {
        'client':'Diego Fernando Rojas Castillo', 'line':'987 654 321', 'account':'000987654321',
        'special_total':62.40, 'usage':28.6,
        'lines':[('Plan Móvil 40 GB','S/59.90'),('Servicio adicional prorrateado (5 días)','S/2.50')],
        'what':'Tu plan base no subió. Se aplicó un cargo proporcional de S/2.50 por cinco días de un servicio adicional dentro del ciclo.',
        'evidence':'Orden PRO-1105, periodo parcial y detalle del recibo.',
    },
    'reconnection': {
        'client':'Diego Fernando Rojas Salazar', 'line':'977 654 321', 'account':'000975312468',
        'special_total':69.90, 'usage':18.6,
        'lines':[('Plan Móvil 40 GB','S/59.90'),('Cargo único por reconexión','S/10.00')],
        'what':'Tu plan no cambió. Este mes aparece un cargo único de S/10.00 por reconexión después de una suspensión del servicio.',
        'evidence':'Orden REC-0805, suspensión SUS-0804 y detalle del recibo.',
    },
    'discount': {
        'client':'Luciana Valeria Rojas Medina', 'line':'987 654 321', 'account':'000987654321',
        'special_total':39.90, 'usage':18.6,
        'lines':[('Plan Móvil 40 GB','S/59.90'),('Bonificación por lealtad','-S/20.00')],
        'what':'Tu plan base sigue en S/59.90. Este mes una bonificación de S/20.00 redujo el monto final a S/39.90.',
        'evidence':'Bonificación comercial aplicada y detalle del recibo.',
    },
}

def rounded(c,x,y,w,h,r,fill,stroke=None,sw=1):
    c.setLineWidth(sw); c.setFillColor(fill); c.setStrokeColor(stroke or fill)
    c.roundRect(x,y,w,h,r,fill=1,stroke=1)

def text(c,x,y,s,size=10,color=NAVY,font='Helvetica',maxw=None):
    c.setFillColor(color); c.setFont(font,size)
    if maxw is None or stringWidth(s,font,size)<=maxw:
        c.drawString(x,y,s); return y
    words=s.split(); line=''; yy=y
    for word in words:
        test=(line+' '+word).strip()
        if stringWidth(test,font,size)>maxw and line:
            c.drawString(x,yy,line); yy-=size*1.35; line=word
        else: line=test
    if line: c.drawString(x,yy,line)
    return yy

def make_receipt(path,scenario,month_idx):
    cfg=scenarios[scenario]
    mname,period,emission,due=months[month_idx]
    is_current=month_idx==len(months)-1
    total=cfg['special_total'] if is_current else 59.90
    usage=cfg['usage'] if is_current else max(12.0,cfg['usage']-(5-month_idx)*1.2)
    remaining=max(0,40-usage)
    lines=cfg['lines'] if is_current else [('Plan Móvil 40 GB','S/59.90')]
    what=cfg['what'] if is_current else 'Tu recibo se mantuvo estable. Solo se registró el cobro mensual del Plan Móvil 40 GB.'
    evidence=cfg['evidence'] if is_current else 'Plan vigente y detalle del recibo.'
    receipt=f"F001-{scenario[:3].upper()}-{month_idx+1:04d}"

    c=canvas.Canvas(str(path),pagesize=A4); W,H=A4; margin=42
    rounded(c,margin,H-82,34,34,8,colors.HexColor('#13A8E8'))
    c.setFillColor(WHITE); c.setFont('Helvetica-BoldOblique',20); c.drawCentredString(margin+17,H-72,'M')
    text(c,margin+46,H-61,'Mi Movistar',17,NAVY,'Helvetica-Bold')
    text(c,margin+46,H-76,'Recibo móvil - documento simulado',8.6,GRAY)
    rounded(c,W-margin-122,H-79,122,30,15,colors.HexColor('#EAF4FB'))
    text(c,W-margin-107,H-69,'SIMULACION ACADEMICA',8.2,BLUE,'Helvetica-Bold')

    y=H-126
    text(c,margin,y,'CLIENTE',8,GRAY,'Helvetica-Bold'); y-=18
    text(c,margin,y,cfg['client'],13.5,NAVY,'Helvetica-Bold'); y-=15
    text(c,margin,y,f"Línea {cfg['line']}  |  Cuenta simulada {cfg['account']}",8.7,GRAY); y-=26

    card_h=91
    rounded(c,margin,y-card_h,W-2*margin,card_h,17,BLUE)
    text(c,margin+20,y-27,f'RECIBO {mname.upper()} 2026',9.5,WHITE)
    text(c,margin+20,y-61,f'S/{total:.2f}',30,WHITE,'Helvetica-Bold')
    text(c,W-margin-105,y-27,'ESTADO',9,WHITE)
    text(c,W-margin-105,y-49,'PENDIENTE',12.5,WHITE,'Helvetica-Bold')
    text(c,W-margin-105,y-67,f'Vence: {due}',8.5,WHITE)
    y-=card_h+35

    cols=[margin,W/2-58,W-margin-115]
    labels=[('PERÍODO FACTURADO',period),('FECHA DE EMISIÓN',emission),('NUMERO DE RECIBO',receipt)]
    for x,(lab,val) in zip(cols,labels):
        text(c,x,y,lab,8,GRAY); text(c,x,y-17,val,9.2,NAVY,'Helvetica-Bold')
    y-=52

    text(c,margin,y,'Detalle de tu recibo',15,NAVY,'Helvetica-Bold'); y-=24
    c.setFillColor(colors.HexColor('#EEF5FA')); c.rect(margin,y-22,W-2*margin,22,fill=1,stroke=0)
    text(c,margin+8,y-15,'Concepto',8,GRAY,'Helvetica-Bold')
    text(c,margin+245,y-15,'Periodo',8,GRAY,'Helvetica-Bold')
    text(c,W-margin-55,y-15,'Importe',8,GRAY,'Helvetica-Bold'); y-=31
    for desc,amt in lines:
        col=GREEN if amt.startswith('-') else NAVY
        text(c,margin+8,y,desc,8.5,col,'Helvetica-Bold' if amt.startswith('-') else 'Helvetica')
        text(c,margin+245,y,period,8.2,col)
        text(c,W-margin-52,y,amt,8.5,col,'Helvetica-Bold' if amt.startswith('-') else 'Helvetica')
        c.setStrokeColor(LINE); c.line(margin,y-8,W-margin,y-8); y-=25
    c.setStrokeColor(BLUE2); c.setLineWidth(1.2); c.line(margin,y+5,W-margin,y+5)
    text(c,margin+8,y-8,'IMPORTE TOTAL',9,NAVY,'Helvetica-Bold')
    text(c,W-margin-66,y-8,f'S/{total:.2f}',9.3,NAVY,'Helvetica-Bold'); y-=42

    box_h=93
    rounded(c,margin,y-box_h,W-2*margin,box_h,15,colors.HexColor('#EDF7FD'))
    rounded(c,margin+12,y-48,28,28,14,BLUE2)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold',13); c.drawCentredString(margin+26,y-40,'i')
    text(c,margin+52,y-24,'Qué pasó este mes',12,NAVY,'Helvetica-Bold')
    yy=text(c,margin+52,y-46,what,8.5,GRAY,maxw=W-2*margin-70)
    text(c,margin+52,yy-18,'Evidencia usada: '+evidence,7.8,BLUE2,maxw=W-2*margin-70)
    y-=box_h+30

    text(c,margin,y,'Tu uso del plan',14,NAVY,'Helvetica-Bold'); y-=24
    rounded(c,margin,y-68,210,68,14,colors.HexColor('#F3F8FC'))
    text(c,margin+18,y-22,'DATOS MOVILES',8,GRAY)
    text(c,margin+18,y-49,f'{usage:.1f} GB',20,NAVY,'Helvetica-Bold')
    text(c,margin+18,y-63,'de 40 GB incluidos',8,GRAY)
    barx=margin+250; bary=y-43; barw=W-margin-barx; barh=12
    rounded(c,barx,bary,barw,barh,6,colors.HexColor('#DDE7ED'))
    rounded(c,barx,bary,max(8,barw*min(1,usage/40)),barh,6,GREEN)
    text(c,barx,y-13,'Consumo del ciclo',8,GRAY)
    text(c,barx,y-64,f'Quedan {remaining:.1f} GB',8.5,NAVY,'Helvetica-Bold')
    text(c,W-margin-60,y-64,'Plan 40 GB',8,GRAY)

    fy=39; c.setStrokeColor(LINE); c.line(margin,fy+22,W-margin,fy+22)
    text(c,margin,fy+6,'Documento ficticio para demostración. No corresponde a una cuenta real ni genera obligación de pago.',6.8,GRAY)
    text(c,margin,fy-7,'Mi Recibo Inteligente - Reto 1: atención inteligente y explicación de recibos.',6.8,GRAY)
    text(c,W-margin-50,fy-7,'Página 1 de 1',6.8,GRAY)
    c.save()

for scen in scenarios:
    d=OUT/scen; d.mkdir(exist_ok=True)
    for i,(mname,*_) in enumerate(months):
        make_receipt(d/f'recibo-{mname}-2026.pdf',scen,i)
print(f'Generated {sum(1 for _ in OUT.rglob("*.pdf"))} PDFs in {OUT}')
