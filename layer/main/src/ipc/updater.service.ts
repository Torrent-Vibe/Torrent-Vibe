import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { getUpdaterHandle } from '~/updater'
import type { UpdaterUiStatus } from '~/updater/status'

export class UpdaterService extends IpcService {
  static override readonly groupName = 'updater'

  @IpcMethod()
  check(): void {
    getUpdaterHandle().checkNow()
  }

  @IpcMethod()
  getStatus(): UpdaterUiStatus {
    return getUpdaterHandle().getStatus()
  }

  @IpcMethod()
  installAndRestart(): void {
    getUpdaterHandle().installNow()
  }
}
