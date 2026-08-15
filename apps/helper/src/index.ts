import { generatePairingCode, loadConfig, resolveToken } from './config'
import { createHelperServer } from './http'
import { advertiseHelper, isMdnsDisabled } from './mdns'
import { createFileReplicaStore } from './store'

async function main() {
  const config = await resolveToken(loadConfig())
  const pairingCode = generatePairingCode()
  const store = createFileReplicaStore(config.dataDir)
  const server = createHelperServer({ config, pairingCode, store })
  const mdns = isMdnsDisabled()
    ? undefined
    : advertiseHelper({ port: config.port, version: config.version })

  server.listen(config.port, () => {
    process.stdout.write(`[helper] listening on :${config.port}\n`)
    process.stdout.write(`[helper] pairing code: ${pairingCode}\n`)
    process.stdout.write(`[helper] advertised qBittorrent: ${config.qbitUrl}\n`)
  })

  async function shutdown() {
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
