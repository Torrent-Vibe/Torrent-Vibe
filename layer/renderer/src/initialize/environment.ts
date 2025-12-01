export const initializeEnvironment = () => {
  const htmlDataset = document.documentElement.dataset

  const isElectronEnvironment =
    typeof ELECTRON !== 'undefined' ? ELECTRON : Boolean(window.ipcRenderer)

  if (isElectronEnvironment) {
    htmlDataset.electron = 'true'
    delete htmlDataset.web
  } else {
    htmlDataset.web = 'true'
    delete htmlDataset.electron
  }

  const platformSource = window.platform ?? navigator.platform ?? ''
  const normalizedPlatform = platformSource.toLowerCase()

  if (normalizedPlatform === 'darwin' || normalizedPlatform.includes('mac')) {
    htmlDataset.macos = 'true'
    delete htmlDataset.windows
  } else if (
    normalizedPlatform === 'win32' ||
    normalizedPlatform.includes('win')
  ) {
    htmlDataset.windows = 'true'
    delete htmlDataset.macos
  } else {
    delete htmlDataset.macos
    delete htmlDataset.windows
  }
}
