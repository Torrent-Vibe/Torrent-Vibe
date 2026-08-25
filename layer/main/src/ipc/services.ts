import type { MergeIpcService } from 'electron-ipc-decorator'
import { createServices } from 'electron-ipc-decorator'

import { AgentChatIPCService } from './agent-chat.service'
import { ApiTokenIPCService } from './api-token.service'
import { AppService } from './app.service'
import { AppSettingsIPCService } from './app-settings.service'
import { FileAssociationService } from './file-association.service'
import { FileSystemService } from './file-system.service'
import { FloatWindowService } from './float-window.service'
import { HelperMdnsService } from './helper-mdns.service'
import { QBittorrentIPCService } from './qbittorrent.service'
import { SecurityIPCService } from './security.service'
import { SystemService } from './system.service'
import { TorrentAiIPCService } from './torrent-ai.service'
import { UpdaterService } from './updater.service'
import { WindowService } from './window.service'

export const services = createServices([
  WindowService,
  AppService,
  AppSettingsIPCService,
  SystemService,
  FileAssociationService,
  SecurityIPCService,
  ApiTokenIPCService,
  AgentChatIPCService,
  FloatWindowService,
  // PanelWindowService,
  QBittorrentIPCService,
  FileSystemService,
  HelperMdnsService,
  TorrentAiIPCService,
  UpdaterService,
])

export const initializeServices = () => {
  void services
}

// Export type for client-side usage
export type IpcServicesType = MergeIpcService<typeof services>
