import {
  captureHttpHandler,
  toNodeLikeRequest
} from '../../backend/vercel/capture-http-server.mjs'

const handler = await captureHttpHandler(
  new URL('../../backend/ai/calls-server.mjs', import.meta.url)
)

export default function health(request, response) {
  return handler(
    toNodeLikeRequest(request),
    response
  )
}
