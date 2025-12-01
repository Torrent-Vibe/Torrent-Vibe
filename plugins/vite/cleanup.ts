import fs from 'node:fs'

import path from 'pathe'
import type { Plugin, ResolvedConfig } from 'vite'

export function cleanupUnnecessaryFilesPlugin(files: string[]): Plugin {
  let config: ResolvedConfig
  return {
    name: 'cleanup-unnecessary',
    enforce: 'post',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    async generateBundle(_options) {
      await Promise.all(
        files.map((file) => {
          console.info(`Deleting ${path.join(config.build.outDir, file)}`)
          return fs.rmSync(path.join(config.build.outDir, file), {
            force: true,
            recursive: true,
          })
        }),
      )
    },
  }
}
