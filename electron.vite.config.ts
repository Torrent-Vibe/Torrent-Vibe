import { fileURLToPath } from 'node:url'

import { defineConfig } from 'electron-vite'
import { join, resolve } from 'pathe'

import { cleanupUnnecessaryFilesPlugin } from './plugins/vite/cleanup'
import { createDependencyChunksPlugin } from './plugins/vite/deps'
import { createPlatformSpecificImportPlugin } from './plugins/vite/specific-import'
import viteConfig from './vite.config'

const PWD = fileURLToPath(new URL('./', import.meta.url))
const ROOT = join(PWD, 'layer/renderer')

export default defineConfig({
  main: {
    plugins: [createDependencyChunksPlugin([[/node_modules\/.*?\//]])],
    build: {
      outDir: 'dist/main',
      lib: {
        entry: './layer/main/src/index.ts',
      },
      rollupOptions: {
        external: ['electron-liquid-glass'],
      },
    },
    resolve: {
      alias: {
        '~': join(PWD, 'layer/main/src'),
        '@locales': join(PWD, 'locales'),
      },
    },

    define: {
      ELECTRON: 'true',

      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
  preload: {
    plugins: [createDependencyChunksPlugin([[/node_modules\/.*?\//]])],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: './layer/main/preload/index.js',
      },
      // bundle cjs
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      },
    },
    resolve: {
      alias: {
        '@pkg': resolve('./package.json'),
      },
    },
  },
  renderer: {
    ...viteConfig,
    plugins: [
      createPlatformSpecificImportPlugin('electron'),
      cleanupUnnecessaryFilesPlugin([
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'apple-touch-icon.png',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon.ico',
        'base.png',
      ]),
      ...viteConfig.plugins!,
    ],
    define: {
      ...viteConfig.define,
      ELECTRON: 'true',
      __WEB_UI__: 'false',
    },
    server: undefined,
    build: {
      ...viteConfig.build,
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          main: resolve(ROOT, 'index.html'),
          mini: resolve(ROOT, 'mini.html'),
          panel: resolve(ROOT, 'panel.html'),
        },
      },
    },
  },
})
