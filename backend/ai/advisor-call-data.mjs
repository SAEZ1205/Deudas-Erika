export const advisorCallCases = {
  'CASO-459463': {
    fullName: 'Sebastián Alexis Euribe Zambrano',
    reason: 'aumento inesperado en el último recibo',
    currentTotal: 82.90,
    previousTotal: 59.90,
    difference: 23.00,
    plan: 59.90,
    evidence: ['10 GB adicionales por S/15.00', 'Movistar Música por S/8.00', 'órdenes PAQ-0810 y MUS-0731'],
    recommendation: 'validar con el cliente si reconoce la activación de ambos servicios antes de cerrar el caso'
  },
  'CASO-218217': {
    fullName: 'Luciana Valeria Rojas Medina',
    reason: 'consulta por un descuento aplicado',
    currentTotal: 39.90,
    previousTotal: 59.90,
    difference: -20.00,
    plan: 59.90,
    evidence: ['bonificación comercial de S/20.00'],
    recommendation: 'confirmar que la cliente entendió la vigencia del beneficio'
  },
  'CASO-771204': {
    fullName: 'Diego Fernando Rojas Castillo',
    reason: 'cobro por prorrateo',
    currentTotal: 62.40,
    previousTotal: 59.90,
    difference: 2.50,
    plan: 59.90,
    evidence: ['cargo proporcional de S/2.50', 'orden PRO-1105', 'periodo parcial de 5 días'],
    recommendation: 'explicar que el plan base no cambió y que el monto corresponde únicamente al periodo parcial'
  },
  'CASO-602318': {
    fullName: 'María Fernanda López Rojas',
    reason: 'confirmación de recibo sin variaciones',
    currentTotal: 59.90,
    previousTotal: 59.90,
    difference: 0,
    plan: 59.90,
    evidence: ['plan vigente de S/59.90', 'sin cargos adicionales confirmados'],
    recommendation: 'confirmar que la cliente no tiene otra duda antes de cerrar el caso'
  },
  'DEMO-RECONNECTION': {
    fullName: 'Cliente demo reconexión',
    reason: 'cargo por reconexión del servicio',
    currentTotal: 69.90,
    previousTotal: 59.90,
    difference: 10.00,
    plan: 59.90,
    evidence: ['cargo único de reconexión por S/10.00', 'registro de suspensión y reactivación'],
    recommendation: 'explicar que el plan base no cambió y que el incremento corresponde únicamente a la reconexión'
  },
  'DEMO-UNVERIFIED': {
    fullName: 'Cliente demo cargo sin evidencia',
    reason: 'cargo de S/9.99 cuyo origen no pudo ser confirmado',
    currentTotal: 41.89,
    previousTotal: 31.90,
    difference: 9.99,
    plan: 31.90,
    evidence: [
      'paquete de 3 GB de Internet por 10 días por S/9.99',
      'el cargo aparece en Facturación',
      'no se encontró una orden asociada que permita confirmar su origen'
    ],
    recommendation:
      'revisar con el cliente el origen del cargo sin afirmar que fue solicitado o activado por él'
  }
}

export const scenarioCallCaseIds = {
  current: 'CASO-602318',
  discount: 'CASO-218217',
  proration: 'CASO-771204',
  reconnection: 'DEMO-RECONNECTION',
  unverified: 'DEMO-UNVERIFIED'
}

const soles = value => {
  const n = Number(value)
  return `S/${n.toFixed(2)}`
}

export function buildAdvisorCallSummary(caseData) {
  const firstName = caseData.fullName.split(' ')[0]
  const evidence = caseData.evidence.join(', ')
  if (caseData.difference > 0) {
    return `Hola, soy LucIA. Tengo listo el contexto del caso de ${firstName}. El cliente consulta por ${caseData.reason}. El recibo anterior fue de ${soles(caseData.previousTotal)} y el actual es de ${soles(caseData.currentTotal)}, una diferencia de ${soles(caseData.difference)}. Su plan base continúa en ${soles(caseData.plan)}. La evidencia encontrada indica ${evidence}. Te recomiendo ${caseData.recommendation}. Eso es todo. Ya puedes continuar con la atención.`
  }
  if (caseData.difference < 0) {
    return `Hola, soy LucIA. Te resumo el caso de ${firstName}. El recibo anterior fue de ${soles(caseData.previousTotal)} y el actual es de ${soles(caseData.currentTotal)}. La reducción corresponde a ${evidence}. El plan base continúa en ${soles(caseData.plan)}. Te recomiendo ${caseData.recommendation}. Ya puedes continuar con la atención.`
  }
  return `Hola, soy LucIA. Te resumo el caso de ${firstName}. El plan se mantiene en ${soles(caseData.plan)} y no existe una variación relevante frente al recibo anterior. La evidencia indica ${evidence}. Te recomiendo ${caseData.recommendation}. Ya puedes continuar con la atención.`
}
