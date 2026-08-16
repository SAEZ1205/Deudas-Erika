export type AdvisorCaseStatus = 'pending' | 'active' | 'resolved' | 'callback'

export type AdvisorCase = {
  id: string
  clientHash: string
  fullName: string
  gender: 'male' | 'female'
  phone: string
  createdAt: string
  reason: string
  shortSummary: string
  status: AdvisorCaseStatus
  receipt: string
  cycle: string
  evidence: string[]
  conversation: { role: 'lucia' | 'client'; text: string }[]
  luciaSummary: string
}

export const advisorCases: AdvisorCase[] = [
  {
    id: 'CASO-459463', clientHash: '#CL-8F2A91', fullName: 'Sebastián Alexis Euribe Zambrano', gender: 'male', phone: '••••••435',
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), reason: '¿Por qué subió mi recibo?', shortSummary: 'Consulta por aumento inesperado en el último ciclo.', status: 'pending',
    receipt: 'F001-005701', cycle: '16 jul - 15 ago',
    evidence: ['Recibo de agosto', 'Orden PAQ-0810', 'Alta MUS-0731'],
    conversation: [
      { role: 'lucia', text: 'Hola, soy LucIA. ¿Qué quieres revisar de tu recibo?' },
      { role: 'client', text: '¿Por qué subió mi recibo?' },
      { role: 'lucia', text: 'Tu recibo subió S/23.00 frente a julio. Tu plan sigue en S/59.90. El aumento viene de 10 GB adicionales por S/15.00 y Movistar Música por S/8.00.' },
      { role: 'lucia', text: 'Preparé este resumen para que el asesor continúe sin pedirte que repitas todo.' }
    ],
    luciaSummary: 'El cliente reconoce su plan base de S/59.90, pero cuestiona dos cargos adicionales. La evidencia encontrada vincula ambos cargos a órdenes registradas. Conviene validar autorización y explicar fechas de alta antes de cerrar el caso.'
  },
  {
    id: 'CASO-218217', clientHash: '#CL-31D7B4', fullName: 'Luciana Valeria Rojas Medina', gender: 'female', phone: '••••••912',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), reason: 'No entiendo mi descuento', shortSummary: 'Quiere confirmar por qué este mes pagó menos.', status: 'active',
    receipt: 'F001-005742', cycle: '16 jul - 15 ago', evidence: ['Recibo de agosto', 'Bonificación comercial -S/20.00'],
    conversation: [
      { role: 'lucia', text: 'Hola, soy LucIA. ¿Qué quieres revisar de tu recibo?' },
      { role: 'client', text: 'por que pague menos este mes?' },
      { role: 'lucia', text: 'Tu plan sigue en S/59.90. Este mes tienes una bonificación de S/20.00 y por eso el total quedó en S/39.90.' }
    ],
    luciaSummary: 'Caso simple y con evidencia completa: plan base sin cambios y bonificación de S/20.00 aplicada correctamente. Solo falta confirmar que la cliente entendió la vigencia del beneficio.'
  },
  {
    id: 'CASO-771204', clientHash: '#CL-90A1C8', fullName: 'Diego Fernando Rojas Castillo', gender: 'male', phone: '••••••608',
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), reason: 'Cobro por prorrateo', shortSummary: 'Pregunta por un cargo proporcional de S/2.50.', status: 'callback',
    receipt: 'F001-005799', cycle: '16 jul - 15 ago', evidence: ['Recibo de agosto', 'Orden PRO-1105', 'Periodo parcial de 5 días'],
    conversation: [
      { role: 'client', text: 'ese 2.50 de que es?' },
      { role: 'lucia', text: 'Es un cobro proporcional por cinco días de un servicio adicional dentro del ciclo. Tu plan base no cambió.' }
    ],
    luciaSummary: 'El monto adicional está respaldado por una orden de alta dentro del ciclo. El cliente pidió que lo contacten luego para terminar la explicación.'
  },
  {
    id: 'CASO-602318', clientHash: '#CL-55E3F2', fullName: 'María Fernanda López Rojas', gender: 'female', phone: '••••••274',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), reason: 'Consulta de recibo resuelta', shortSummary: 'Se confirmó que no existían cargos adicionales.', status: 'resolved',
    receipt: 'F001-005644', cycle: '16 jul - 15 ago', evidence: ['Recibo de agosto', 'Plan vigente S/59.90'],
    conversation: [
      { role: 'client', text: 'solo queria saber si subio mi plan' },
      { role: 'lucia', text: 'No. Tu plan continúa en S/59.90 y no aparecen cargos adicionales en este ciclo.' }
    ],
    luciaSummary: 'Consulta resuelta digitalmente. El plan se mantiene sin variaciones y no se detectaron extras.'
  }
]
