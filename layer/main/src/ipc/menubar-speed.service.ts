import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import type { SpeedData } from '~/manager/menubar-speed-manager'
import { MenubarSpeedManager } from '~/manager/menubar-speed-manager'

export class MenubarSpeedService extends IpcService {
  static override readonly groupName = 'menubarSpeed'

  @IpcMethod()
  updateSpeed(_context: IpcContext, data: SpeedData): void {
    MenubarSpeedManager.instance.updateSpeed(data)
  }

  @IpcMethod()
  initialize(): void {
    MenubarSpeedManager.instance.initialize()
  }

  @IpcMethod()
  stop(): void {
    MenubarSpeedManager.instance.stop()
  }
}
