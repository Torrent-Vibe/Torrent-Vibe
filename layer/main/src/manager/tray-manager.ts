import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'pathe'

import { FloatWindowManager } from './float-window-manager'
import { WindowManager } from './window-manager'

export class TrayManager {
  private static _instance: TrayManager | null = null
  static get instance(): TrayManager {
    if (!this._instance) this._instance = new TrayManager()
    return this._instance
  }

  private tray: Tray | null = null

  initialize(): void {
    if (this.tray) return

    const iconPath = join(__dirname, '../..', 'resources', 'icon.png')
    const image = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(image)
    this.tray.setToolTip(app.getName())
    this.refreshMenu()
  }

  refreshMenu(): void {
    if (!this.tray) return
    const wm = WindowManager.getInstance()
    const fm = FloatWindowManager.getInstance()
    const floatingMode = fm.getFloatingMode()
    const template = [
      {
        label: 'Show Main Window',
        click: () => wm.showMainWindow(),
      },
      {
        label: 'Toggle Floating',
        click: async () => {
          await fm.toggleFloatWindow()
        },
      },
      { type: 'separator' as const },
      {
        label: floatingMode ? 'Disable Floating Mode' : 'Enable Floating Mode',
        click: () => {
          fm.setFloatingMode(!floatingMode)
          this.refreshMenu()
        },
      },
      { type: 'separator' as const },
      {
        label: 'Quit',
        role: 'quit' as const,
      },
    ]
    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }
}
