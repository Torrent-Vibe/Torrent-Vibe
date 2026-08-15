import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
