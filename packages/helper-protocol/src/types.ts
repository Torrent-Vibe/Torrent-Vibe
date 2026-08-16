export type HelperEpisodeState
  = | 'pending'
    | 'added'
    | 'downloading'
    | 'renaming'
    | 'done'
    | 'failed'
    | 'needs-manual'
    | 'skipped'

export interface SubscriptionRecord {
  id: string
  providerId: 'mikan'
  bangumiId: string
  title: string
  coverUrl?: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  rssUrl: string
  targetServerIds: string[]
  syncByServer: Record<
    string,
    {
      status: 'ok' | 'pending' | 'error'
      lastError?: string
      lastPushedAt?: string
    }
  >
  createdAt: string
  updatedAt: string
}

export interface HelperReplica {
  id: string
  bangumiId: string
  title: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  rssUrl: string
}

export type DesiredStateOp
  = { type: 'add', replica: HelperReplica } | { type: 'remove', id: string }
