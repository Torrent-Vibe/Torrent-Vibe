const { contextBridge, ipcRenderer } = require('electron')

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // Environment information
  isElectron: true,
  isDevelopment: process.env.NODE_ENV === 'development',
  platform: process.platform,
}

const ipcRendererBridge = {
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args)
  },
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener)
  },
  once: (channel, listener) => {
    ipcRenderer.once(channel, listener)
  },
  invoke: (channel, ...args) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener)
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  },

  addListener: (channel, listener) => {
    ipcRenderer.addListener(channel, listener)
  },
}

// Expose the API to the renderer process

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
    contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererBridge)
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('platform', process.platform)
  } catch (error) {
    console.error(error)
  }
}
