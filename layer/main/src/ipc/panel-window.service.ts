import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { FloatWindowManager } from '../manager/float-window-manager'

export class PanelWindowService extends IpcService {
  private floatManager: FloatWindowManager

  static override readonly groupName = 'panel'

  constructor() {
    super()
    this.floatManager = FloatWindowManager.getInstance()
  }

  @IpcMethod()
  async show(): Promise<void> {
    await this.floatManager.expandFloatWindow()
  }

  @IpcMethod()
  hide(): void {
    // Hide only if cursor is not inside panel window
    this.floatManager.hidePanelWindow(true)
  }
}
