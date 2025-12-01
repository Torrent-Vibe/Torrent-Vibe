import { app } from 'electron'
import { join } from 'pathe'

export class IconManager {
  public static instance: IconManager = new IconManager()
  private windowIconPath: string | null = null

  private constructor() {}

  setAppIcons(): void {
    try {
      const iconPath = this.getIconPath()
      if (!iconPath) {
        console.warn('No suitable icon found for current platform')
        return
      }
      if (process.platform === 'darwin' && app.dock) {
        app.dock.setIcon(iconPath)
        console.info('Dock icon set successfully:', iconPath)
      }
      if (process.platform !== 'darwin') {
        this.setWindowIconPath(iconPath)
        console.info('Application icon path set for window creation:', iconPath)
      }
      console.info(
        'Application icons configured for platform:',
        process.platform,
      )
    } catch (error) {
      console.error('Failed to set application icons:', error)
    }
  }

  getWindowIconPath(): string | null {
    return this.windowIconPath
  }

  private setWindowIconPath(iconPath: string): void {
    this.windowIconPath = iconPath
  }

  private getIconPath(): string | null {
    const resourcesPath = join(__dirname, '../..', 'resources')
    return join(resourcesPath, 'icon.png')
  }
}
