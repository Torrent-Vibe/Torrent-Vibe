import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { WindowManager } from '../manager/window-manager'

export class WindowService extends IpcService {
  private windowManager: WindowManager

  static override readonly groupName = 'window'

  constructor() {
    super()
    // Use singleton WindowManager instance
    this.windowManager = WindowManager.getInstance()
  }

  @IpcMethod()
  showMainWindow(): void {
    this.windowManager.showMainWindow()
  }

  @IpcMethod()
  hideMainWindow(): void {
    this.windowManager.hideMainWindow()
  }

  @IpcMethod()
  focusMainWindow(): void {
    this.windowManager.focusMainWindow()
  }

  @IpcMethod()
  minimizeMainWindow(): void {
    this.windowManager.minimizeMainWindow()
  }

  @IpcMethod()
  maximizeMainWindow(): void {
    this.windowManager.maximizeMainWindow()
  }

  @IpcMethod()
  toggleMaximizeMainWindow(): void {
    this.windowManager.toggleMaximizeMainWindow()
  }

  @IpcMethod()
  closeMainWindow(): void {
    this.windowManager.closeMainWindow()
  }
}
