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

struct HelperSubscriptionSnapshot: Encodable, Hashable, Sendable {
  let revision: UInt64
  let replicas: [HelperReplica]
}

extension HelperSubscriptionSnapshot: Decodable {
  enum CodingKeys: String, CodingKey {
    case revision
    case replicas
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    revision = try container.decode(UInt64.self, forKey: .revision)
    replicas = try container.decodeNullAsEmpty([HelperReplica].self, forKey: .replicas)
  }
}

struct HelperReplicaStatus: Encodable, Hashable, Identifiable, Sendable {
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

extension HelperReplicaStatus: Decodable {
  enum CodingKeys: String, CodingKey {
    case id
    case bangumiId
    case title
    case bangumiSubjectId
    case subgroupId
    case subgroupName
    case rssUrl
    case episodes
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    bangumiId = try container.decode(String.self, forKey: .bangumiId)
    title = try container.decode(String.self, forKey: .title)
    bangumiSubjectId = try container.decodeIfPresent(String.self, forKey: .bangumiSubjectId)
    subgroupId = try container.decode(String.self, forKey: .subgroupId)
    subgroupName = try container.decode(String.self, forKey: .subgroupName)
    rssUrl = try container.decode(String.self, forKey: .rssUrl)
    episodes = try container.decodeMissingOrNull([HelperEpisodeStatus].self, forKey: .episodes)
  }
}

struct HelperJobStatus: Encodable, Hashable, Identifiable, Sendable {
  let bangumiId: String
  let subgroupId: String
  let episodes: [HelperEpisodeStatus]

  var id: String { "\(bangumiId):\(subgroupId)" }
}

extension HelperJobStatus: Decodable {
  enum CodingKeys: String, CodingKey {
    case bangumiId
    case subgroupId
    case episodes
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    bangumiId = try container.decode(String.self, forKey: .bangumiId)
    subgroupId = try container.decode(String.self, forKey: .subgroupId)
    episodes = try container.decodeMissingOrNull([HelperEpisodeStatus].self, forKey: .episodes)
  }
}

struct HelperRuntimeStatus: Encodable, Hashable, Sendable {
  let replicas: [HelperReplicaStatus]
  let jobs: [HelperJobStatus]
}

extension HelperRuntimeStatus: Decodable {
  enum CodingKeys: String, CodingKey {
    case replicas
    case jobs
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    replicas = try container.decodeMissingOrNull([HelperReplicaStatus].self, forKey: .replicas)
    jobs = try container.decodeMissingOrNull([HelperJobStatus].self, forKey: .jobs)
  }
}

struct HelperBackfillEpisode: Codable, Hashable, Sendable {
  let episodeId: String
  let title: String
  let torrentUrl: String
  let publishedAt: String?
  let sizeBytes: Int64?
}

struct HelperBackfillResult: Encodable, Hashable, Sendable {
  let episodes: [HelperEpisodeStatus]
}

extension HelperBackfillResult: Decodable {
  enum CodingKeys: String, CodingKey {
    case episodes
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    episodes = try container.decodeMissingOrNull([HelperEpisodeStatus].self, forKey: .episodes)
  }
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

struct HelperProfileSnapshot: Encodable, Hashable, Sendable {
  let revision: UInt64
  let records: [HelperProfileRecord]
}

extension HelperProfileSnapshot: Decodable {
  enum CodingKeys: String, CodingKey {
    case revision
    case records
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    revision = try container.decode(UInt64.self, forKey: .revision)
    records = try container.decodeNullAsEmpty([HelperProfileRecord].self, forKey: .records)
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

private extension KeyedDecodingContainer {
  func decodeMissingOrNull<T: Decodable>(_ type: [T].Type, forKey key: Key) throws -> [T] {
    try decodeIfPresent([T].self, forKey: key) ?? []
  }

  func decodeNullAsEmpty<T: Decodable>(_ type: [T].Type, forKey key: Key) throws -> [T] {
    if try decodeNil(forKey: key) {
      return []
    }
    return try decode([T].self, forKey: key)
  }
}
