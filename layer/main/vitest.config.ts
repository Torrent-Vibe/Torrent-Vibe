import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const PWD = fileURLToPath(new URL('./', import.meta.url))

function rawLoaderPlugin() {
  const RAW_SUFFIX = '?raw'
  return {
    name: 'raw-loader',
    resolveId(id: string, importer: string | undefined) {
      if (!id.endsWith(RAW_SUFFIX)) {
        return null
      }
      const cleaned = id.slice(0, -RAW_SUFFIX.length)
      const base = importer ? dirname(importer) : PWD
      return `${resolve(base, cleaned)}${RAW_SUFFIX}`
    },
    load(id: string) {
      if (!id.endsWith(RAW_SUFFIX)) {
        return null
      }
      const file = id.slice(0, -RAW_SUFFIX.length)
      return `export default ${JSON.stringify(readFileSync(file, 'utf8'))}`
    },
  }
}

export default defineConfig({
  plugins: [rawLoaderPlugin()],
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
