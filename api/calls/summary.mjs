import {
  captureHttpHandler,
  toNodeLikeRequest
} from '../_capture-http-server.mjs'

const handler = await captureHttpHandler(
  new URL('../../backend/ai/calls-server.mjs', import.meta.url)
)

export default function summary(request, response) {
  return handler(
    toNodeLikeRequest(request),
    response
  )
}
