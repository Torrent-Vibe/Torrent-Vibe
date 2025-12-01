import { arch, freemem, platform, totalmem, version } from 'node:os'

import { nativeTheme } from 'electron'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

export class SystemService extends IpcService {
  static override readonly groupName = 'system'

  @IpcMethod()
  getTheme(): string {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  @IpcMethod()
  setTheme(context: IpcContext, theme: 'dark' | 'light' | 'system'): void {
    nativeTheme.themeSource = theme
  }

  @IpcMethod()
  getSystemInfo() {
    return {
      platform: platform(),
      arch: arch(),
      version: version(),
      totalMemory: totalmem(),
      freeMemory: freemem(),
    }
  }
}
