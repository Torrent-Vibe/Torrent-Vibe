import { app } from 'electron'

import { DeeplinkManager } from './deeplink-manager'
import { FileOpenManager } from './file-open-manager'
import { WindowManager } from './window-manager'

export class SingleInstanceManager {
  public static instance: SingleInstanceManager = new SingleInstanceManager()
  private constructor() {}

  initialize(): void {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
      app.quit()
      return
    }

    app.on('second-instance', (_event, argv) => {
      void WindowManager.getInstance().showMainWindow()
      FileOpenManager.instance.handleSecondInstance(argv)
      DeeplinkManager.instance.handleSecondInstance(argv)
    })
  }
}
