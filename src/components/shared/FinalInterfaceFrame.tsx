export function FinalInterfaceFrame() {
  const query = typeof window === 'undefined' ? '' : window.location.search
  return (
    <iframe
      title="Mi Movistar · Recibo inteligente"
      src={`/app-final.html${query}`}
      className="block h-[100dvh] w-full border-0 bg-white"
      allow="microphone"
    />
  )
}
