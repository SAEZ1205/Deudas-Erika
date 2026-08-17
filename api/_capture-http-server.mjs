import http from 'node:http'

/**
 * Importa un servidor Node existente y captura su requestListener sin
 * permitir que abra un puerto. Esto permite reutilizar exactamente la
 * lógica actual de backend/ai/*.mjs dentro de Vercel Functions.
 *
 * Los servidores locales no se modifican y continúan funcionando con
 * npm run lucia / npm run calls.
 */
export async function captureHttpHandler(moduleUrl, beforeImport) {
  if (beforeImport) {
    await beforeImport()
  }

  const originalCreateServer = http.createServer
  let requestHandler = null

  http.createServer = (...args) => {
    const candidate = args[args.length - 1]

    if (typeof candidate === 'function') {
      requestHandler = candidate
    }

    // Suficiente para las cadenas createServer(...).listen(...) actuales.
    // No abre sockets dentro de la función serverless.
    return {
      listen() {
        return this
      },
      on() {
        return this
      },
      once() {
        return this
      },
      ref() {
        return this
      },
      unref() {
        return this
      },
      close(callback) {
        if (typeof callback === 'function') callback()
        return this
      },
      address() {
        return null
      }
    }
  }

  try {
    await import(moduleUrl.href)
  } finally {
    http.createServer = originalCreateServer
  }

  if (!requestHandler) {
    throw new Error(
      `No se pudo capturar el request handler de ${moduleUrl.href}`
    )
  }

  return requestHandler
}
