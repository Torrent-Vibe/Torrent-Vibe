import { generatePairingCode, loadConfig, resolveToken } from './config'
import { createHelperServer } from './http'
import { backfill, startLoop } from './loop'
import { advertiseHelper, isMdnsDisabled } from './mdns'
import { createQbClient } from './qb'
import { createFileReplicaStore } from './store'

async function main() {
  const config = await resolveToken(loadConfig())
  const pairingCode = generatePairingCode()
  const store = createFileReplicaStore(config.dataDir)
  const qb = createQbClient({
    baseUrl: config.qbitUrl,
    username: config.qbitUser,
    password: config.qbitPass,
  })
  const loopDeps = {
    store,
    qb,
    libraryRoot: config.libraryRoot,
    pollIntervalMs: config.pollIntervalMs,
    fetchRss: async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`rss ${response.status}`)
      }
      return response.text()
    },
  }
  const server = createHelperServer({
    config,
    pairingCode,
    store,
    onBackfill: input => backfill(loopDeps, input),
  })
  const loop = startLoop(loopDeps)
  const mdns = isMdnsDisabled()
    ? undefined
    : advertiseHelper({ port: config.port, version: config.version })

  server.listen(config.port, () => {
    process.stdout.write(`[helper] listening on :${config.port}\n`)
    process.stdout.write(`[helper] pairing code: ${pairingCode}\n`)
    process.stdout.write(`[helper] advertised qBittorrent: ${config.qbitUrl}\n`)
  })

  async function shutdown() {
    loop.stop()
    mdns?.stop()
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()))
    })
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })
}

void main()
