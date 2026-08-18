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

struct HelperConfigPublic: Decodable, Hashable, Sendable {
  var hasTmdbApiKey: Bool
  var libraryRoot: String
  var organizeOnComplete: Bool

  init(hasTmdbApiKey: Bool = false, libraryRoot: String = "", organizeOnComplete: Bool = false) {
    self.hasTmdbApiKey = hasTmdbApiKey
    self.libraryRoot = libraryRoot
    self.organizeOnComplete = organizeOnComplete
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    hasTmdbApiKey = try container.decodeIfPresent(Bool.self, forKey: .hasTmdbApiKey) ?? false
    libraryRoot = try container.decodeIfPresent(String.self, forKey: .libraryRoot) ?? ""
    organizeOnComplete = try container.decodeIfPresent(Bool.self, forKey: .organizeOnComplete) ?? false
  }
}

struct HelperOrganizeResult: Codable, Hashable, Sendable {
  let hash: String
  let status: String
  let libraryRelPath: String?
  let dest: String?
  let reason: String?
  let tmdbId: Int?

  var isSuccess: Bool { status == "ok" || status == "already" }

  var userMessage: String {
    switch status {
    case "ok":
      if let dest, !dest.isEmpty {
        return "已整理到 \(dest)"
      }
      return "整理完成"
    case "already":
      return dest.map { "已经整理过 · \($0)" } ?? "已经整理过"
    case "skipped":
      return "Helper 追更剧集在入库时已经整理"
    case "needs-manual":
      switch reason {
      case "missing-tmdb-key":
        return "请通过凭证同步上传 TMDB"
      case "missing-library-root":
        return "请先设置 Helper 媒体库根目录"
      case "no-unique-tmdb":
        return "TMDB 没有唯一匹配"
      case "missing-episode":
        return "无法识别集数"
      case "dest-conflict":
        return "目标位置已有不同文件"
      case "collection":
        return "合集不会自动整理"
      case "unsupported-kind":
        return "该类型不会自动整理"
      case "no-video":
        return "没有可整理的视频文件"
      default:
        return "需要手动整理"
      }
    default:
      return "无法整理该任务"
    }
  }
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
