from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from pathlib import Path

BASE = Path('recibos')
SCENARIOS = {
 'current': {'label':'Condicion normal','months':[('marzo',59.90,'Monto estable, sin cargos adicionales.'),('abril',59.90,'Monto estable, sin cargos adicionales.'),('mayo',59.90,'Monto estable, sin cargos adicionales.'),('junio',59.90,'Monto estable, sin cargos adicionales.'),('julio',59.90,'Monto estable, sin cargos adicionales.'),('agosto',59.90,'Monto estable, sin cargos adicionales.')], 'extra':None, 'evidence':'Plan vigente y detalle del recibo.'},
 'proration': {'label':'Prorrateo','months':[('marzo',59.90,'Monto estable.'),('abril',59.90,'Monto estable.'),('mayo',62.40,'Proteccion Movil estuvo activa 5 dias. Se cobraron S/2.50 proporcionalmente.'),('junio',59.90,'El cargo prorrateado no se repitio.'),('julio',59.90,'Monto estable.'),('agosto',62.40,'Proteccion Movil estuvo activa 5 dias. Se cobraron S/2.50 proporcionalmente.')], 'extra':('Proteccion Movil - prorrateo 5 dias',2.50), 'evidence':'Cargo proporcional, periodo parcial y orden relacionada.'},
 'reconnection': {'label':'Reconexion','months':[('marzo',59.90,'Monto estable.'),('abril',59.90,'Monto estable.'),('mayo',59.90,'Monto estable.'),('junio',59.90,'Monto estable.'),('julio',59.90,'Monto estable.'),('agosto',69.90,'Se aplico un cargo unico de S/10.00 por reconexion tras suspension.')], 'extra':('Cargo unico por reconexion',10.00), 'evidence':'Cargo en factura, suspension y reactivacion relacionadas.'},
 'discount': {'label':'Descuento','months':[('marzo',59.90,'Monto estable.'),('abril',59.90,'Monto estable.'),('mayo',59.90,'Monto estable.'),('junio',59.90,'Monto estable.'),('julio',59.90,'Monto estable.'),('agosto',39.90,'Bonificacion de S/20.00 aplicada al precio regular del plan.')], 'extra':('Bonificacion comercial',-20.00), 'evidence':'Precio base y ajuste comercial en el recibo.'}
}
DATES={'marzo':('16 feb 2026 - 15 mar 2026','31 mar 2026','15 abr 2026'),'abril':('16 mar 2026 - 15 abr 2026','30 abr 2026','15 may 2026'),'mayo':('16 abr 2026 - 15 may 2026','31 may 2026','15 jun 2026'),'junio':('16 may 2026 - 15 jun 2026','30 jun 2026','15 jul 2026'),'julio':('16 jun 2026 - 15 jul 2026','31 jul 2026','15 ago 2026'),'agosto':('16 jul 2026 - 15 ago 2026','10 ago 2026','25 ago 2026')}
BLUE=HexColor('#019BE1'); DARK=HexColor('#0B2739'); GRAY=HexColor('#687782'); BOX=HexColor('#EFF8FC')

def wrap(c,text,x,y,maxw,size=9,leading=5*mm):
    line=''
    for word in text.split():
        test=(line+' '+word).strip()
        if c.stringWidth(test,'Helvetica',size)>maxw and line:
            c.drawString(x,y,line); y-=leading; line=word
        else: line=test
    if line: c.drawString(x,y,line)

def make_pdf(path,scenario,month,total,explanation,extra,evidence,idx):
    path.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(path),pagesize=A4); W,H=A4
    c.setFillColor(BLUE); c.rect(0,H-28*mm,W,28*mm,stroke=0,fill=1)
    c.setFillColorRGB(1,1,1); c.setFont('Helvetica-Bold',18); c.drawString(18*mm,H-17*mm,'Mi Movistar')
    c.setFont('Helvetica',9); c.drawRightString(W-18*mm,H-17*mm,'Recibo movil - SIMULACION ACADEMICA')
    y=H-42*mm; c.setFillColor(DARK); c.setFont('Helvetica-Bold',13); c.drawString(18*mm,y,f'RECIBO {month.upper()} 2026'); c.setFont('Helvetica-Bold',25); c.drawRightString(W-18*mm,y,f'S/{total:.2f}')
    y-=12*mm; period,issued,due=DATES[month]; c.setFont('Helvetica',9); c.setFillColor(GRAY); c.drawString(18*mm,y,f'Cliente demo: DEMO-{scenario.upper()}'); c.drawString(18*mm,y-5*mm,'Linea simulada: 968 821 435'); c.drawRightString(W-18*mm,y,f'Vence: {due}'); c.drawRightString(W-18*mm,y-5*mm,f'Emision: {issued}')
    y-=18*mm; c.setFillColor(DARK); c.setFont('Helvetica-Bold',12); c.drawString(18*mm,y,'Detalle de tu recibo'); y-=8*mm
    rows=[('Plan Movil 40 GB',59.90)]
    if month=='agosto' and extra: rows.append(extra)
    elif scenario=='proration' and month=='mayo': rows.append(extra)
    for desc,amt in rows:
        c.setFont('Helvetica',10); c.drawString(20*mm,y,desc); c.drawRightString(W-20*mm,y,f"{'-' if amt<0 else ''}S/{abs(amt):.2f}"); y-=7*mm
    c.setStrokeColor(BLUE); c.line(18*mm,y+2*mm,W-18*mm,y+2*mm); c.setFont('Helvetica-Bold',11); c.drawString(20*mm,y-3*mm,'TOTAL'); c.drawRightString(W-20*mm,y-3*mm,f'S/{total:.2f}')
    y-=20*mm; c.setFillColor(BOX); c.roundRect(18*mm,y-34*mm,W-36*mm,40*mm,4*mm,stroke=0,fill=1); c.setFillColor(DARK); c.setFont('Helvetica-Bold',11); c.drawString(23*mm,y,'Que paso este mes'); c.setFont('Helvetica',9); wrap(c,explanation,23*mm,y-7*mm,W-48*mm)
    c.setFont('Helvetica-Oblique',8); c.setFillColor(GRAY); c.drawString(23*mm,y-29*mm,'Evidencia: '+evidence[:95]); y-=50*mm
    c.setFillColor(DARK); c.setFont('Helvetica-Bold',11); c.drawString(18*mm,y,'Periodo facturado'); c.setFont('Helvetica',9); c.drawString(18*mm,y-7*mm,period); c.setFont('Helvetica-Bold',11); c.drawString(18*mm,y-20*mm,'Consumo del ciclo'); c.setFont('Helvetica',9); c.drawString(18*mm,y-27*mm,f'{23+idx*1.6:.1f} GB usados de 40 GB incluidos')
    c.setFillColor(GRAY); c.setFont('Helvetica',7); c.drawString(18*mm,12*mm,'Documento ficticio para demostracion. No corresponde a una cuenta real ni genera obligacion de pago.'); c.drawRightString(W-18*mm,12*mm,'Mi Recibo Inteligente - Reto 1'); c.save()

for scenario,data in SCENARIOS.items():
    for idx,(month,total,exp) in enumerate(data['months']):
        make_pdf(BASE/scenario/f'recibo-{month}-2026.pdf',scenario,month,total,exp,data['extra'],data['evidence'],idx)
print('Generados 24 PDFs de demo')
