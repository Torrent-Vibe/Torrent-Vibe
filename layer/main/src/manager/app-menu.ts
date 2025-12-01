import type { MenuItem, MenuItemConstructorOptions } from 'electron'
import { app, Menu, shell } from 'electron'
import contextMenu from 'electron-context-menu'
import log from 'electron-log'

import { APP_NAME, isDevelopment, isMacOS } from '~/constants'
import { BridgeService } from '~/services/bridge-service'
import { UpdateService } from '~/services/update-service'

import { i18n, t } from '../utils/i18n'
import { WindowManager } from './window-manager'

export class AppMenuManager {
  public static instance: AppMenuManager = new AppMenuManager()
  private constructor() {}

  initialize() {
    this.createMenu()
    // Re-create menus when language changes to reflect updated i18n labels
    if (!this.languageListenerRegistered) {
      this.languageListenerRegistered = true
      i18n.on('languageChanged', () => {
        this.createMenu()
      })
    }
  }

  private registerAppMenu() {
    const menus: Array<MenuItemConstructorOptions | MenuItem> = [
      ...(isMacOS
        ? ([
            {
              label: APP_NAME,
              submenu: [
                {
                  type: 'normal',
                  label: t('menu.about', { name: APP_NAME }),
                  click: () => {
                    BridgeService.shared.broadcast('settings:open', {
                      tab: 'about',
                    })
                  },
                },
                { type: 'separator' },
                {
                  label: t('menu.settings'),
                  accelerator: 'CmdOrCtrl+,',
                  click: () =>
                    BridgeService.shared.broadcast('settings:open', {
                      tab: 'appearance',
                    }),
                },
                { type: 'separator' },
                { role: 'services', label: t('menu.services') },
                { type: 'separator' },
                { role: 'hide', label: t('menu.hide', { name: APP_NAME }) },
                { role: 'hideOthers', label: t('menu.hideOthers') },
                { type: 'separator' },
                {
                  label: t('menu.checkForUpdates'),
                  click: () => {
                    UpdateService.shared.checkAndPrepareUpdate()
                  },
                },
                { type: 'separator' },

                { role: 'quit', label: t('menu.quit', { name: APP_NAME }) },
              ],
            },
          ] as MenuItemConstructorOptions[])
        : []),

      {
        label: t('menu.file'),
        submenu: [{ role: 'close', label: t('menu.close') }],
      },
      {
        label: t('menu.edit'),
        submenu: [
          { role: 'undo', label: t('menu.undo') },
          { role: 'redo', label: t('menu.redo') },
          { type: 'separator' },
          { role: 'cut', label: t('menu.cut') },
          { role: 'copy', label: t('menu.copy') },
          { role: 'paste', label: t('menu.paste') },
          { type: 'separator' },

          ...((isMacOS
            ? [
                {
                  role: 'pasteAndMatchStyle',
                  label: t('menu.pasteAndMatchStyle'),
                },
                { role: 'delete', label: t('menu.delete') },
                { role: 'selectAll', label: t('menu.selectAll') },
                { type: 'separator' },
                {
                  label: t('menu.speech'),
                  submenu: [
                    { role: 'startSpeaking', label: t('menu.startSpeaking') },
                    { role: 'stopSpeaking', label: t('menu.stopSpeaking') },
                  ],
                },
              ]
            : [
                { role: 'delete', label: t('menu.delete') },
                { type: 'separator' },
                { role: 'selectAll', label: t('menu.selectAll') },
              ]) as MenuItemConstructorOptions[]),
        ],
      },
      {
        role: 'viewMenu',
        label: t('menu.view'),
        submenu: [
          { role: 'reload', label: t('menu.reload') },
          { role: 'forceReload', label: t('menu.forceReload') },
          { role: 'toggleDevTools', label: t('menu.toggleDevTools') },
          { type: 'separator' },

          { role: 'togglefullscreen', label: t('menu.toggleFullScreen') },
        ],
      },
      {
        role: 'windowMenu',
        label: t('menu.window'),
        submenu: [
          {
            role: 'minimize',
            label: t('menu.minimize'),
          },
          {
            role: 'zoom',
            label: t('menu.zoom'),
          },
          {
            type: 'separator',
          },
          {
            role: 'front',
            label: t('menu.front'),
          },
          {
            label: t('menu.alwaysOnTop'),
            type: 'checkbox',
            checked: WindowManager.getInstance()
              .getMainWindow()
              ?.isAlwaysOnTop(),
            click: () => {
              const mainWindow = WindowManager.getInstance().getMainWindow()
              if (!mainWindow) return
              mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop())
              this.registerAppMenu()
            },
          },
        ],
      },
      ...(isDevelopment
        ? ([
            {
              label: t('menu.debug'),
              submenu: [
                {
                  label: t('menu.switchContentLoader'),
                  type: 'checkbox',
                  checked: WindowManager.getInstance().isUsingHotUpdate(),
                  click: async () => {
                    await WindowManager.getInstance().switchContentLoader()
                    // Update the menu to reflect the new state
                    this.registerAppMenu()
                  },
                },

                { type: 'separator' },
                {
                  label: t('menu.reloadWindow'),
                  accelerator: 'F5',
                  click: async () => {
                    await WindowManager.getInstance().reloadWindowContent()
                  },
                },
                {
                  label: t('menu.forceReload'),
                  accelerator: 'CmdOrCtrl+Shift+R',
                  click: () => {
                    WindowManager.getInstance().forceReloadWindow()
                  },
                },
                { type: 'separator' },
                {
                  label: `${t('menu.currentLoader')}: ${WindowManager.getInstance().getCurrentContentLoaderType()}`,
                  enabled: false,
                },
              ],
            },
          ] as MenuItemConstructorOptions[])
        : []),
      {
        role: 'help',
        label: t('menu.help'),
        submenu: [
          {
            label: t('menu.openLogFile'),
            click: async () => {
              const filePath = log.transports.file.getFile().path
              return await shell.openPath(filePath)
            },
          },
          {
            label: t('menu.openUserDataDirectory'),
            click: async () => {
              const filePath = app.getPath('userData')
              return await shell.openPath(filePath)
            },
          },
        ],
      },
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(menus))
  }

  private contextMenuDisposer: (() => void) | null = null
  private languageListenerRegistered = false
  private createMenu() {
    this.registerAppMenu()
    if (this.contextMenuDisposer) {
      this.contextMenuDisposer()
    }

    this.contextMenuDisposer = contextMenu({
      showSaveImageAs: true,
      showCopyLink: true,
      showCopyImageAddress: true,
      showCopyImage: true,
      showInspectElement: isDevelopment,
      showSelectAll: true,
      showCopyVideoAddress: true,
      showSaveVideoAs: true,

      labels: {
        saveImageAs: t('contextMenu.saveImageAs'),
        copyLink: t('contextMenu.copyLink'),
        copyImageAddress: t('contextMenu.copyImageAddress'),
        copyImage: t('contextMenu.copyImage'),
        copyVideoAddress: t('contextMenu.copyVideoAddress'),
        saveVideoAs: t('contextMenu.saveVideoAs'),
        inspect: t('contextMenu.inspect'),
        copy: t('contextMenu.copy'),
        cut: t('contextMenu.cut'),
        paste: t('contextMenu.paste'),
        saveImage: t('contextMenu.saveImage'),
        saveVideo: t('contextMenu.saveVideo'),
        selectAll: t('contextMenu.selectAll'),
        services: t('contextMenu.services'),
        searchWithGoogle: t('contextMenu.searchWithGoogle'),
        learnSpelling: t('contextMenu.learnSpelling'),
        lookUpSelection: t('contextMenu.lookUpSelection'),
        saveLinkAs: t('contextMenu.saveLinkAs'),
      },

      prepend: (_defaultActions, params) => {
        return [
          {
            label: t('contextMenu.openImageInBrowser'),
            visible: params.mediaType === 'image',
            click: () => {
              shell.openExternal(params.srcURL)
            },
          },
          {
            label: t('contextMenu.openLinkInBrowser'),
            visible: params.linkURL !== '',
            click: () => {
              shell.openExternal(params.linkURL)
            },
          },
          {
            role: 'undo',
            label: t('menu.undo'),
            accelerator: 'CmdOrCtrl+Z',
            visible: params.isEditable,
          },
          {
            role: 'redo',
            label: t('menu.redo'),
            accelerator: 'CmdOrCtrl+Shift+Z',
            visible: params.isEditable,
          },
        ]
      },
    })
  }
}
