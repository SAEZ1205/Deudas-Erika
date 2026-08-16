# MOVISTAR-Reto1 · Mi Recibo Inteligente

Proyecto reorganizado con **React + TypeScript + Vite + Tailwind CSS** sin rediseñar la interfaz final aprobada.

## Regla de esta migración

La interfaz visual final está congelada en `public/app-final.html` y utiliza los mismos assets recuperados, LucIA, promociones y PDFs. `src/App.tsx` la monta a pantalla completa para que la reorganización interna no cambie la experiencia visual.

No se utiliza la fuente React antigua.

## Ejecutar

```powershell
npm install
Copy-Item .env.example .env.local
code .env.local
npm run dev:full
```

Abrir `http://127.0.0.1:3000`.

Sin Gemini se puede usar `npm run dev`; LucIA mantiene su fallback local.

## Estructura

- `src/pages/cliente`: pantallas del cliente para migración modular futura.
- `src/pages/asesor`: dashboard y detalle de casos.
- `src/components`: componentes por dominio.
- `src/services`: acceso a facturación, LucIA, handoff y ofertas.
- `src/types`: contratos TypeScript.
- `backend/data/raw`: dataset oficial local; no se versiona.
- `backend/data/processed`: salidas procesadas.
- `backend/data/demo`: cuatro escenarios de demo.
- `backend/ai`: servidor local LucIA/Gemini.
- `public`: interfaz final intacta, imágenes, banners y 24 PDFs.

## Seguridad

Nunca subir `GEMINI_API_KEY`. Usa `.env.local`.
