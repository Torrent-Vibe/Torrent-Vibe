import type { IpcServicesType } from '@torrent-vibe/main'
import type { IpcRenderer } from 'electron'
import { createIpcProxy } from 'electron-ipc-decorator/client'

declare global {
  interface Window {
    ipcRenderer: IpcRenderer
  }
}

// Create the IPC proxy for renderer process
export const ipcServices = createIpcProxy<IpcServicesType>(
  window.ipcRenderer ?? null,
)
