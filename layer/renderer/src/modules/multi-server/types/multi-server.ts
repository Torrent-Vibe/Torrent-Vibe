import { z } from 'zod'

import type { QBittorrentConfig } from '~/shared/types/qbittorrent'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface ServerConnection {
  id: string
  name: string
  config: QBittorrentConfig
  isDefault: boolean
  lastConnected?: string
  status: ConnectionStatus
  tags?: string[]
  color?: string
}

export type MultiServerConfig = z.infer<typeof multiServerConfigSchema>
// Unified with shared QBittorrentConfig shape
export const qbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0),
  username: z.string().min(1),
  password: z.string(),
  useHttps: z.boolean(),
  baseUrl: z.string().optional(),
})

export const serverConnectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  config: qbConfigSchema,
  isDefault: z.boolean(),
  lastConnected: z.string().optional(),
  status: z.union([
    z.literal('disconnected'),
    z.literal('connecting'),
    z.literal('connected'),
    z.literal('error'),
  ]),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
})

export const multiServerConfigSchema = z.object({
  servers: z.array(serverConnectionSchema),
  activeServerId: z.string().nullable(),
})

export type ServerHealthStatus = 'healthy' | 'warning' | 'unhealthy'

export interface ServerHealthResult {
  serverId: string
  status: ServerHealthStatus
  responseTime: number
  lastChecked: string
  consecutiveFailures: number
  version?: string
  error?: string
}
