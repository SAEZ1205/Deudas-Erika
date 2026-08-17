import http from 'node:http'
import { Readable } from 'node:stream'

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

/**
 * Vercel puede entregar request.body ya parseado. Los servidores actuales
 * leen el body con `for await (const chunk of req)`, por lo que recreamos
 * un IncomingMessage-like stream sin alterar la lógica de los handlers.
 */
export function toNodeLikeRequest(request) {
  if (
    request.body === undefined ||
    request.body === null ||
    request.method === 'GET' ||
    request.method === 'HEAD'
  ) {
    return request
  }

  const body =
    typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body)

  const stream = Readable.from([body])

  stream.method = request.method
  stream.url = request.url
  stream.headers = request.headers
  stream.httpVersion = request.httpVersion
  stream.socket = request.socket
  stream.connection = request.connection

  return stream
}
