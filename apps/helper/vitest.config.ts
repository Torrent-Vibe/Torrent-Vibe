import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
    env: {
      MIKAN_HELPER_DISABLE_MDNS: '1',
    },
  },
})
