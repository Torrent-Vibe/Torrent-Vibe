export type HelperEpisodeState =
  | 'pending'
  | 'added'
  | 'downloading'
  | 'renaming'
  | 'done'
  | 'failed'
  | 'needs-manual'
  | 'skipped'

export interface SubscriptionRecord {
  bangumiId: string
  bangumiSubjectId?: string
  coverUrl?: string
  createdAt: string
  id: string
  providerId: 'mikan'
  rssUrl: string
  subgroupId: string
  subgroupName: string
  syncByServer: Record<
    string,
    {
      status: 'ok' | 'pending' | 'error'
      lastError?: string
      lastPushedAt?: string
    }
  >
  targetServerIds: string[]
  title: string
  updatedAt: string
}

export interface HelperReplica {
  bangumiId: string
  bangumiSubjectId?: string
  id: string
  rssUrl: string
  subgroupId: string
  subgroupName: string
  title: string
}

export interface HelperSubscriptionSnapshot {
  replicas: HelperReplica[]
  revision: number
}

export type DesiredStateOp =
  { type: 'add'; replica: HelperReplica } | { type: 'remove'; id: string }
