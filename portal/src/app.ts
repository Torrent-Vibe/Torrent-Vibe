import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { registerRoutes } from './routes'
import { ErrorCode, isServiceError } from './services/error-interceptor'

export function createApp() {
  const app = new Hono()
  app.use('/*', cors())

  app.onError((err, c) => {
    const status = (() => {
      if (isServiceError(err)) {
        switch (err.code) {
          case ErrorCode.VALIDATION_ERROR: {
            return 400
          }
          case ErrorCode.NOT_FOUND: {
            return 404
          }
          case ErrorCode.PERMISSION_DENIED: {
            return 403
          }
          case ErrorCode.ALREADY_EXISTS: {
            return 409
          }
          case ErrorCode.NETWORK_ERROR: {
            return 503
          }
          case ErrorCode.TIMEOUT: {
            return 504
          }
          case ErrorCode.BAD_RESPONSE:
          case ErrorCode.EXTERNAL_API_ERROR: {
            return 502
          }

          default: {
            return 500
          }
        }
      }
      return 500
    })()

    const payload = isServiceError(err)
      ? {
          success: false,
          message: err.message,
          error: { code: err.code, status: err.status },
        }
      : {
          success: false,
          message: (err as Error).message,
          error: { code: ErrorCode.UNKNOWN },
        }

    return c.json(payload, status)
  })
  registerRoutes(app)
  return app
}
