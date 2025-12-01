import type { Hono } from 'hono'

export function registerRoutes(app: Hono) {
  app.get('/api/health', (c) => c.json({ status: 'ok' }))
}
