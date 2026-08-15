import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '~': src,
    },
  },
  define: {
    ELECTRON: 'false',
  },
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
