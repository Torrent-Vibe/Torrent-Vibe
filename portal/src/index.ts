/// <reference types="bun-types" />

import { createApp } from './app'
import { config } from './config'

const app = createApp()

Bun.serve({
  port: config.port,
  fetch: app.fetch,
})
