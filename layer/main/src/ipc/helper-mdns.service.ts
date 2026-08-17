import Bonjour from 'bonjour-service'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

export interface HelperMdnsServiceInfo {
  host: string
  name: string
  port: number
  version: string
}

export class HelperMdnsService extends IpcService {
  static override readonly groupName = 'helperMdns'

  private browser: ReturnType<Bonjour['find']> | null = null
  private bonjour: Bonjour | null = null
  private services = new Map<string, HelperMdnsServiceInfo>()

  @IpcMethod()
  startBrowse(): void {
    if (this.browser) {
      return
    }
    this.bonjour = new Bonjour()
    this.browser = this.bonjour.find({
      type: 'torrentvibe-helper',
      protocol: 'tcp',
    })
    this.browser.on(
      'up',
      (service: {
        name?: string
        host?: string
        referer?: { address?: string }
        port?: number
        txt?: Record<string, string>
      }) => {
        const host = service.host || service.referer?.address
        if (!host || !service.port) {
          return
        }
        const name = service.name || host
        this.services.set(`${name}:${service.port}`, {
          name,
          host,
          port: service.port,
          version: service.txt?.version ?? '',
        })
      },
    )
    this.browser.on('down', (service: { name?: string; port?: number }) => {
      if (!service.name || !service.port) {
        return
      }
      this.services.delete(`${service.name}:${service.port}`)
    })
  }

  @IpcMethod()
  stopBrowse(): void {
    this.browser?.stop()
    this.browser = null
    this.bonjour?.destroy()
    this.bonjour = null
    this.services.clear()
  }

  @IpcMethod()
  list(): HelperMdnsServiceInfo[] {
    return [...this.services.values()]
  }
}
