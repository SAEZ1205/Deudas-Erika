import { FinalInterfaceFrame } from './components/shared/FinalInterfaceFrame'
import DashboardAsesor from './pages/asesor/DashboardAsesor'
import CasoDetalle from './pages/asesor/CasoDetalle'

export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/asesor/caso/')) return <CasoDetalle />
  if (path === '/asesor' || path === '/asesor/') return <DashboardAsesor />
  return <FinalInterfaceFrame />
}
