import {
  captureHttpHandler,
  toNodeLikeRequest
} from './_capture-http-server.mjs'

const handler = await captureHttpHandler(
  new URL('../backend/ai/server.mjs', import.meta.url),
  async () => {
    if (!process.env.DATA_ENGINE_URL && process.env.VERCEL_URL) {
      process.env.DATA_ENGINE_URL = `https://${process.env.VERCEL_URL}`
    }
  }
)

export default function lucia(request, response) {
  return handler(
    toNodeLikeRequest(request),
    response
  )
}
