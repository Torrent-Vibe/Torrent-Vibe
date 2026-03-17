import { safeStorage } from 'electron'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

export class SecurityIPCService extends IpcService {
  static override readonly groupName = 'security'

  @IpcMethod()
  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    }
    catch {
      return false
    }
  }

  @IpcMethod()
  encryptString(plaintext: string): string {
    const buf = safeStorage.encryptString(plaintext)
    return buf.toString('base64')
  }

  @IpcMethod()
  decryptString(base64: string): string {
    const buf = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buf)
  }
}
