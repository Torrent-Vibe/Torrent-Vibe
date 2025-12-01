import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import reactRefresh from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { join } from 'pathe'
import { defineConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { routeBuilderPlugin } from 'vite-plugin-route-builder'
import tsconfigPaths from 'vite-tsconfig-paths'

import PKG from './package.json'
import { cleanupUnnecessaryFilesPlugin } from './plugins/vite/cleanup'
import { createDependencyChunksPlugin } from './plugins/vite/deps'
import { customI18nHmrPlugin } from './plugins/vite/i18n-hmr'
import { createPlatformSpecificImportPlugin } from './plugins/vite/specific-import'

const ROOT = join(
  fileURLToPath(new URL('./', import.meta.url)),
  'layer/renderer',
)

const IS_ELECTRON_RENDER_BUILD = process.env.ELECTRON_RENDER_BUILD === '1'
export default defineConfig({
  root: ROOT,
  base: IS_ELECTRON_RENDER_BUILD ? './' : process.env.BASE_URL || '/',
  plugins: [
    reactRefresh({
      babel: {
        // plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tsconfigPaths(),
    customI18nHmrPlugin(),

    codeInspectorPlugin({
      bundler: 'vite',
      hotKeys: ['altKey'],
    }),
    nodePolyfills({ include: ['path', 'buffer', 'crypto'] }),
    tailwindcss(),
    routeBuilderPlugin({
      pagePattern: `${join(ROOT, './src/apps/main/pages')}/**/*.tsx`,
      outputPath: `${join(ROOT, './src/apps/main/generated-routes.ts')}`,
      enableInDev: true,
    }),
    createDependencyChunksPlugin([[/node_modules\/.*?\//]]),
    process.env.ANALYZE === '1' ? analyzer() : [],

    IS_ELECTRON_RENDER_BUILD
      ? [
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
        ]
      : [],
  ],
  server: {
    proxy: {
      '/api/v2': {
        target: 'http://10.0.0.32:18888',
        changeOrigin: true,
      },
    },
    allowedHosts: ['local.innei.in'],
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    ELECTRON: IS_ELECTRON_RENDER_BUILD ? 'true' : 'false',
    APP_DEV_CWD: JSON.stringify(process.cwd()),
    APP_NAME: JSON.stringify(PKG.name),
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    // Runtime license decides trial/pro; keep build-time flag false
    __WEB_UI__: JSON.stringify(!IS_ELECTRON_RENDER_BUILD),
  },
})
