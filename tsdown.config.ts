import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

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

const ELECTRON_EXTERNALS = ['electron', /^electron\//]
const MAIN_PROCESS_EXTERNALS = [
  ...ELECTRON_EXTERNALS,
  'electron-liquid-glass',
  'sqlite3',
  'bindings',
  'node-gyp-build',
  'bufferutil',
  'utf-8-validate',
]

export default defineConfig([
  {
    entry: 'layer/main/src/index.ts',
    outDir: 'dist/main',
    format: 'esm',
    platform: 'node',
    tsconfig: 'layer/main/tsconfig.json',
    fixedExtension: false,
    shims: true,
    plugins: [rawLoaderPlugin()],
    alias: {
      '~': `${PWD}layer/main/src`,
      '@locales': `${PWD}locales`,
    },
    define: {
      ELECTRON: 'true',
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    deps: {
      neverBundle: MAIN_PROCESS_EXTERNALS,
    },
    dts: false,
    clean: true,
  },
  {
    entry: 'layer/main/preload/index.js',
    outDir: 'dist/preload',
    format: 'cjs',
    platform: 'node',
    fixedExtension: false,
    deps: {
      neverBundle: ELECTRON_EXTERNALS,
    },
    dts: false,
    clean: true,
  },
])
