import { safeStorage } from 'electron'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

export class SecurityIPCService extends IpcService {
  static override readonly groupName = 'security'

  @IpcMethod()
  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  @IpcMethod()
  encryptString(_context: IpcContext, plaintext: string): string {
    const buf = safeStorage.encryptString(plaintext)
    return buf.toString('base64')
  }

  @IpcMethod()
  decryptString(_context: IpcContext, base64: string): string {
    const buf = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buf)
  }
}
