import { fileURLToPath } from 'node:url'

import { join, resolve } from 'pathe'
import { defineConfig } from 'vite'

import { cleanupUnnecessaryFilesPlugin } from './plugins/vite/cleanup'
import { createPlatformSpecificImportPlugin } from './plugins/vite/specific-import'
import viteConfig from './vite.config'

const PWD = fileURLToPath(new URL('./', import.meta.url))
const ROOT = join(PWD, 'layer/renderer')

export default defineConfig({
  ...viteConfig,
  base: './',
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
    outDir: join(PWD, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(ROOT, 'index.html'),
        mini: resolve(ROOT, 'mini.html'),
        panel: resolve(ROOT, 'panel.html'),
      },
    },
  },
})
