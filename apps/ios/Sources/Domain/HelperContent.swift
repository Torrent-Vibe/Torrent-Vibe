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
    case .pending: String(localized: "等待处理")
    case .added: String(localized: "已添加")
    case .downloading: String(localized: "下载中")
    case .renaming: String(localized: "正在整理")
    case .done: String(localized: "已完成")
    case .failed: String(localized: "失败")
    case .needsManual: String(localized: "需要处理")
    case .skipped: String(localized: "已跳过")
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

struct HelperReplicaStatus: Hashable, Identifiable, Sendable {
  let id: String
  let bangumiId: String
  let title: String
  let bangumiSubjectId: String?
  let subgroupId: String
  let subgroupName: String
  let rssUrl: String
  let episodes: [HelperEpisodeStatus]
  let checkedAt: Date?
  let checkError: String?
  let consecutiveFailures: Int?

  init(
    id: String,
    bangumiId: String,
    title: String,
    bangumiSubjectId: String?,
    subgroupId: String,
    subgroupName: String,
    rssUrl: String,
    episodes: [HelperEpisodeStatus],
    checkedAt: Date? = nil,
    checkError: String? = nil,
    consecutiveFailures: Int? = nil
  ) {
    self.id = id
    self.bangumiId = bangumiId
    self.title = title
    self.bangumiSubjectId = bangumiSubjectId
    self.subgroupId = subgroupId
    self.subgroupName = subgroupName
    self.rssUrl = rssUrl
    self.episodes = episodes
    self.checkedAt = checkedAt
    self.checkError = checkError
    self.consecutiveFailures = consecutiveFailures
  }

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

extension HelperReplicaStatus: Codable {
  enum CodingKeys: String, CodingKey {
    case id
    case bangumiId
    case title
    case bangumiSubjectId
    case subgroupId
    case subgroupName
    case rssUrl
    case episodes
    case checkedAt
    case checkError
    case consecutiveFailures
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
    checkedAt = try container.decodeTimestampIfPresent(forKey: .checkedAt)
    checkError = try container.decodeIfPresent(String.self, forKey: .checkError)
    consecutiveFailures = try container.decodeIfPresent(Int.self, forKey: .consecutiveFailures)
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(bangumiId, forKey: .bangumiId)
    try container.encode(title, forKey: .title)
    try container.encodeIfPresent(bangumiSubjectId, forKey: .bangumiSubjectId)
    try container.encode(subgroupId, forKey: .subgroupId)
    try container.encode(subgroupName, forKey: .subgroupName)
    try container.encode(rssUrl, forKey: .rssUrl)
    try container.encode(episodes, forKey: .episodes)
    try container.encodeIfPresent(checkedAt.map(HelperTimestamp.format), forKey: .checkedAt)
    try container.encodeIfPresent(checkError, forKey: .checkError)
    try container.encodeIfPresent(consecutiveFailures, forKey: .consecutiveFailures)
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
  let source: HelperSubscriptionSource
  let checkedAt: Date?
  let checkError: String?
  let consecutiveFailures: Int?

  var id: UUID { serverID }

  init(
    serverID: UUID,
    serverName: String,
    replicaID: String,
    episodes: [HelperEpisodeStatus],
    source: HelperSubscriptionSource = .helper,
    checkedAt: Date? = nil,
    checkError: String? = nil,
    consecutiveFailures: Int? = nil
  ) {
    self.serverID = serverID
    self.serverName = serverName
    self.replicaID = replicaID
    self.episodes = episodes
    self.source = source
    self.checkedAt = checkedAt
    self.checkError = checkError
    self.consecutiveFailures = consecutiveFailures
  }
}

struct HelperSubscriptionGroup: Hashable, Identifiable, Sendable {
  let replica: HelperReplica
  let targets: [HelperSubscriptionTarget]

  var id: String { "\(replica.bangumiId):\(replica.subgroupId)" }
  var accessibilityID: String { "\(replica.bangumiId)-\(replica.subgroupId)" }
  var targetServerIDs: Set<UUID> { Set(targets.map(\.serverID)) }
}

enum HelperSubscriptionSource: Equatable, Sendable {
  case cache
  case helper
}

enum HelperSubscriptionLoadState: Equatable, Sendable {
  case failed(String)
  case idle
  case loaded(
    snapshot: HelperSubscriptionSnapshot, status: HelperRuntimeStatus,
    source: HelperSubscriptionSource)
  case loading
  case needsRepairing
}

struct HelperEvent: Identifiable, Sendable {
  let seq: UInt64
  let at: Date
  let level: String
  let kind: String
  let replicaId: String?
  let bangumiId: String?
  let subgroupId: String?
  let episodeId: String?
  let message: String
  let fields: [String: HelperEventFieldValue]?

  var id: UInt64 { seq }
}

extension HelperEvent: Equatable {
  static func == (lhs: HelperEvent, rhs: HelperEvent) -> Bool {
    lhs.seq == rhs.seq && lhs.at == rhs.at && lhs.level == rhs.level && lhs.kind == rhs.kind
      && lhs.replicaId == rhs.replicaId && lhs.bangumiId == rhs.bangumiId
      && lhs.subgroupId == rhs.subgroupId && lhs.episodeId == rhs.episodeId
      && lhs.message == rhs.message && lhs.fields == rhs.fields
  }
}

extension HelperEvent: Hashable {
  func hash(into hasher: inout Hasher) {
    hasher.combine(seq)
    hasher.combine(at)
    hasher.combine(level)
    hasher.combine(kind)
    hasher.combine(replicaId)
    hasher.combine(bangumiId)
    hasher.combine(subgroupId)
    hasher.combine(episodeId)
    hasher.combine(message)
    for key in fields?.keys.sorted() ?? [] {
      hasher.combine(key)
      hasher.combine(fields?[key])
    }
  }
}

extension HelperEvent: Codable {
  enum CodingKeys: String, CodingKey {
    case seq
    case at
    case level
    case kind
    case replicaId
    case bangumiId
    case subgroupId
    case episodeId
    case message
    case fields
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    seq = try container.decode(UInt64.self, forKey: .seq)
    at = try container.decodeTimestamp(forKey: .at)
    level = try container.decode(String.self, forKey: .level)
    kind = try container.decode(String.self, forKey: .kind)
    replicaId = try container.decodeIfPresent(String.self, forKey: .replicaId)
    bangumiId = try container.decodeIfPresent(String.self, forKey: .bangumiId)
    subgroupId = try container.decodeIfPresent(String.self, forKey: .subgroupId)
    episodeId = try container.decodeIfPresent(String.self, forKey: .episodeId)
    message = try container.decode(String.self, forKey: .message)
    fields =
      (try? container.decodeIfPresent([String: HelperEventFieldValue].self, forKey: .fields))
      ?? nil
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(seq, forKey: .seq)
    try container.encode(HelperTimestamp.format(at), forKey: .at)
    try container.encode(level, forKey: .level)
    try container.encode(kind, forKey: .kind)
    try container.encodeIfPresent(replicaId, forKey: .replicaId)
    try container.encodeIfPresent(bangumiId, forKey: .bangumiId)
    try container.encodeIfPresent(subgroupId, forKey: .subgroupId)
    try container.encodeIfPresent(episodeId, forKey: .episodeId)
    try container.encode(message, forKey: .message)
    try container.encodeIfPresent(fields, forKey: .fields)
  }
}

struct HelperEventsPage: Encodable, Hashable, Sendable {
  let events: [HelperEvent]
  let cursor: UInt64
}

extension HelperEventsPage: Decodable {
  enum CodingKeys: String, CodingKey {
    case events
    case cursor
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    events = try container.decodeMissingOrNull([HelperEvent].self, forKey: .events)
    cursor = try container.decodeIfPresent(UInt64.self, forKey: .cursor) ?? 0
  }
}

private enum HelperTimestamp {
  static func parse(_ value: String) -> Date? {
    withFractionalSeconds.date(from: value) ?? standard.date(from: value)
  }

  static func format(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
  }

  private static var withFractionalSeconds: ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }

  private static var standard: ISO8601DateFormatter { ISO8601DateFormatter() }
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

  func decodeTimestamp(forKey key: Key) throws -> Date {
    let value = try decode(String.self, forKey: key)
    guard let date = HelperTimestamp.parse(value) else {
      throw DecodingError.dataCorruptedError(
        forKey: key, in: self, debugDescription: "invalid timestamp")
    }
    return date
  }

  func decodeTimestampIfPresent(forKey key: Key) throws -> Date? {
    guard let value = try decodeIfPresent(String.self, forKey: key) else { return nil }
    guard let date = HelperTimestamp.parse(value) else {
      throw DecodingError.dataCorruptedError(
        forKey: key, in: self, debugDescription: "invalid timestamp")
    }
    return date
  }
}
