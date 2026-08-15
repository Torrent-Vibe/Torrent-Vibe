import { hostname } from 'node:os'

import Bonjour from 'bonjour-service'

export function isMdnsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MIKAN_HELPER_DISABLE_MDNS === '1'
}

export function advertiseHelper(options: { port: number, version: string }) {
  const bonjour = new Bonjour()
  const service = bonjour.publish({
    name: `torrent-vibe-helper-${hostname()}`,
    type: 'torrentvibe-helper',
    protocol: 'tcp',
    port: options.port,
    txt: { version: options.version },
  })

  return {
    stop() {
      service.stop()
      bonjour.destroy()
    },
  }
}
