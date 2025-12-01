// import type { BrowserWindow } from 'electron'
// import { app, screen } from 'electron'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

// import { WindowManager } from '~/manager/window-manager'

// import { FloatWindowManager } from '../manager/float-window-manager'

export class FloatWindowService extends IpcService {
  // private floatManager: FloatWindowManager
  // private dragSession: {
  //   win: BrowserWindow
  //   offsetX: number
  //   offsetY: number
  //   timer: NodeJS.Timeout | null
  //   lastX?: number
  //   lastY?: number
  // } | null = null

  static override readonly groupName = 'float'

  constructor() {
    super()
    // this.floatManager = FloatWindowManager.getInstance()
    // app.on('browser-window-blur', () => this.stopDrag())
  }

  @IpcMethod()
  async show(): Promise<void> {
    // await this.floatManager.showFloatWindow()
  }

  @IpcMethod()
  hide(): void {
    // this.floatManager.hideFloatWindow()
  }

  @IpcMethod()
  async toggle(): Promise<void> {
    // await this.floatManager.toggleFloatWindow()
  }

  @IpcMethod()
  async openMainAndHide(): Promise<void> {
    // const wm = WindowManager.getInstance()
    // await wm.createMainWindow()
    // wm.showMainWindow()
    // this.floatManager.hideFloatWindow()
  }

  @IpcMethod()
  setFloatingMode(_enabled: boolean): void {
    // this.floatManager.setFloatingMode(enabled)
  }

  @IpcMethod()
  getFloatingMode(): boolean {
    // return this.floatManager.getFloatingMode()
    return false
  }

  @IpcMethod()
  setShowFloatOnClose(_context: IpcContext, _enabled: boolean): void {
    // this.floatManager.setShowFloatOnClose(enabled)
  }

  @IpcMethod()
  getShowFloatOnClose(): boolean {
    // return this.floatManager.getShowFloatOnClose()
    return false
  }

  @IpcMethod()
  hidePanelWindow(): void {
    // this.floatManager.hidePanelWindow()
  }

  // Custom window dragging to avoid app-region and keep events
  @IpcMethod()
  async startDrag(_ctx: { sender: Electron.WebContents }): Promise<void> {
    // Always drag the float window (not the panel)
    // const win = await this.floatManager.createFloatWindow()
    // this.stopDrag()
    // // Hide panel during dragging to improve performance
    // this.floatManager.hidePanelWindow()
    // if (!win.isVisible()) win.showInactive()
    // const cursor = screen.getCursorScreenPoint()
    // const bounds = win.getBounds()
    // this.dragSession = {
    //   win,
    //   offsetX: cursor.x - bounds.x,
    //   offsetY: cursor.y - bounds.y,
    //   timer: null,
    // }
    // this.startPolling()
  }

  @IpcMethod()
  endDrag(): void {
    // this.stopDrag()
  }

  private startPolling() {
    // if (!this.dragSession || this.dragSession.timer) return
    // this.dragSession.timer = setInterval(() => {
    //   if (!this.dragSession) return
    //   const p = screen.getCursorScreenPoint()
    //   const x = Math.round(p.x - this.dragSession.offsetX)
    //   const y = Math.round(p.y - this.dragSession.offsetY)
    //   if (x === this.dragSession.lastX && y === this.dragSession.lastY) return
    //   this.dragSession.lastX = x
    //   this.dragSession.lastY = y
    //   if (!this.dragSession.win.isDestroyed()) {
    //     this.dragSession.win.setPosition(x, y)
    //   }
    // }, 16)
  }

  private stopDrag() {
    // if (!this.dragSession) return
    // if (this.dragSession.timer) clearInterval(this.dragSession.timer)
    // this.dragSession.timer = null
    // this.dragSession = null
  }
}
