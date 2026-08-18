import Foundation

enum HelperEpisodeState: String, Codable, Hashable, Sendable {
  case added
  case done
  case downloading
  case failed
  case needsManual = "needs-manual"
  case pending
  case renaming
  case skipped

  var title: String {
    switch self {
    case .pending: "等待处理"
    case .added: "已添加"
    case .downloading: "下载中"
    case .renaming: "正在整理"
    case .done: "已完成"
    case .failed: "失败"
    case .needsManual: "需要处理"
    case .skipped: "已跳过"
    }
  }

  var isRetryable: Bool {
    self == .failed || self == .needsManual
  }
}

struct HelperEpisodeStatus: Codable, Hashable, Identifiable, Sendable {
  let episodeId: String
  let title: String
  let season: Int?
  let episode: Int?
  let state: HelperEpisodeState
  let infohash: String?
  let lastError: String?

  var id: String { episodeId }
}

struct HelperReplica: Codable, Hashable, Identifiable, Sendable {
  let id: String
  let bangumiId: String
  let title: String
  let bangumiSubjectId: String?
  let subgroupId: String
  let subgroupName: String
  let rssUrl: String
}

struct HelperSubscriptionSnapshot: Codable, Hashable, Sendable {
  let revision: UInt64
  let replicas: [HelperReplica]
}

struct HelperReplicaStatus: Codable, Hashable, Identifiable, Sendable {
  let id: String
  let bangumiId: String
  let title: String
  let bangumiSubjectId: String?
  let subgroupId: String
  let subgroupName: String
  let rssUrl: String
  let episodes: [HelperEpisodeStatus]

  var replica: HelperReplica {
    HelperReplica(
      id: id,
      bangumiId: bangumiId,
      title: title,
      bangumiSubjectId: bangumiSubjectId,
      subgroupId: subgroupId,
      subgroupName: subgroupName,
      rssUrl: rssUrl
    )
  }
}

struct HelperJobStatus: Codable, Hashable, Identifiable, Sendable {
  let bangumiId: String
  let subgroupId: String
  let episodes: [HelperEpisodeStatus]

  var id: String { "\(bangumiId):\(subgroupId)" }
}

struct HelperRuntimeStatus: Codable, Hashable, Sendable {
  let replicas: [HelperReplicaStatus]
  let jobs: [HelperJobStatus]
}

struct HelperBackfillEpisode: Codable, Hashable, Sendable {
  let episodeId: String
  let title: String
  let torrentUrl: String
  let publishedAt: String?
  let sizeBytes: Int64?
}

struct HelperBackfillResult: Codable, Hashable, Sendable {
  let episodes: [HelperEpisodeStatus]
}

struct HelperRetryRequest: Codable, Hashable, Sendable {
  let bangumiId: String
  let subgroupId: String
  let episodeId: String
  let title: String?
  let torrentUrl: String?
}

struct HelperSubscriptionMutation: Hashable, Sendable {
  let snapshot: HelperSubscriptionSnapshot
  let mergedConflict: Bool
}

struct HelperProfileRecord: Codable, Hashable, Identifiable, Sendable {
  let key: String
  let value: String
  let secret: Bool
  let updatedAt: String
  let updatedBy: String

  var id: String { key }
}

struct HelperProfileSnapshot: Codable, Hashable, Sendable {
  let revision: UInt64
  let records: [HelperProfileRecord]
}

struct HelperProfileMutation: Codable, Hashable, Sendable {
  let operation: String
  let key: String
  let value: String?
  let secret: Bool?

  static func set(key: String, value: String, secret: Bool) -> Self {
    Self(operation: "set", key: key, value: value, secret: secret)
  }
}

struct HelperSubscriptionTarget: Hashable, Identifiable, Sendable {
  let serverID: UUID
  let serverName: String
  let replicaID: String
  let episodes: [HelperEpisodeStatus]

  var id: UUID { serverID }
}

struct HelperSubscriptionGroup: Hashable, Identifiable, Sendable {
  let replica: HelperReplica
  let targets: [HelperSubscriptionTarget]

  var id: String { "\(replica.bangumiId):\(replica.subgroupId)" }
  var accessibilityID: String { "\(replica.bangumiId)-\(replica.subgroupId)" }
  var targetServerIDs: Set<UUID> { Set(targets.map(\.serverID)) }
}

enum HelperSubscriptionLoadState: Equatable, Sendable {
  case failed(String)
  case idle
  case loaded(snapshot: HelperSubscriptionSnapshot, status: HelperRuntimeStatus)
  case loading
}
