import Foundation

protocol HelperService: Sendable {
  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo
  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential
  func status(at baseURL: URL, token: String) async throws -> HelperStatus
  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot
  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot
  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot
  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus
  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult
  func retry(
    at baseURL: URL,
    token: String,
    request: HelperRetryRequest
  ) async throws -> HelperBackfillResult
  func unpair(at baseURL: URL, token: String) async throws
}

struct HelperDiscoveryInfo: Hashable, Sendable {
  let version: String
  let capabilities: [String]
  let clientCount: Int
  let requiresPairingCode: Bool
}

struct HelperPairingCredential: Hashable, Sendable {
  let clientID: String
  let token: String
}

struct HelperStatus: Hashable, Sendable {
  let version: String
  let clientCount: Int
  let subscriptionCount: Int
  let pendingItems: Int
}

struct URLSessionHelperService: HelperService {
  private let session: URLSession

  init(session: URLSession = .shared) {
    self.session = session
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    let payload: DiscoverPayload = try await request(baseURL, path: "discover")
    guard payload.requiresPairingCode else {
      throw HelperServiceError.unsupportedProtocol
    }
    return HelperDiscoveryInfo(
      version: payload.version,
      capabilities: payload.capabilities ?? [],
      clientCount: payload.clientCount,
      requiresPairingCode: payload.requiresPairingCode
    )
  }

  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential {
    let body = PairRequest(code: code, clientId: clientID, clientName: clientName)
    let payload: PairPayload = try await request(
      baseURL,
      path: "pair",
      method: "POST",
      body: body
    )
    guard !payload.token.isEmpty else {
      throw HelperServiceError.invalidResponse
    }
    return HelperPairingCredential(
      clientID: payload.clientId.isEmpty ? clientID : payload.clientId,
      token: payload.token
    )
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    async let discovery = discover(at: baseURL)
    async let status = runtimeStatus(at: baseURL, token: token)
    let (discoveryInfo, statusPayload) = try await (discovery, status)
    let episodes =
      statusPayload.replicas.flatMap(\.episodes) + statusPayload.jobs.flatMap(\.episodes)
    let pendingItems = episodes.count { ![.done, .skipped].contains($0.state) }
    return HelperStatus(
      version: discoveryInfo.version,
      clientCount: discoveryInfo.clientCount,
      subscriptionCount: statusPayload.replicas.count,
      pendingItems: pendingItems
    )
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    try await request(baseURL, path: "profile", token: token)
  }

  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    try await request(
      baseURL,
      path: "profile",
      method: "PATCH",
      token: token,
      body: UpdateProfileRequest(revision: revision, mutations: mutations)
    )
  }

  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  {
    try await request(baseURL, path: "subscriptions", token: token)
  }

  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    try await request(
      baseURL,
      path: "subscriptions",
      method: "PUT",
      token: token,
      body: ReplaceSubscriptionsRequest(revision: revision, replicas: replicas)
    )
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    try await request(baseURL, path: "status", token: token)
  }

  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    try await request(
      baseURL,
      path: "backfill",
      method: "POST",
      token: token,
      body: BackfillRequest(
        bangumiId: bangumiID,
        subgroupId: subgroupID,
        episodes: episodes
      )
    )
  }

  func retry(
    at baseURL: URL,
    token: String,
    request retryRequest: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    try await request(
      baseURL,
      path: "retry",
      method: "POST",
      token: token,
      body: retryRequest
    )
  }

  func unpair(at baseURL: URL, token: String) async throws {
    let _: EmptyResponse = try await request(
      baseURL,
      path: "unpair",
      method: "POST",
      token: token
    )
  }

  private func request<Response: Decodable>(
    _ baseURL: URL,
    path: String,
    method: String = "GET",
    token: String? = nil
  ) async throws -> Response {
    try await request(
      baseURL,
      path: path,
      method: method,
      token: token,
      body: Optional<NoBody>.none
    )
  }

  private func request<Response: Decodable, Body: Encodable>(
    _ baseURL: URL,
    path: String,
    method: String = "GET",
    token: String? = nil,
    body: Body?
  ) async throws -> Response {
    var request = URLRequest(url: endpoint(baseURL, path: path))
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    if let body {
      request.httpBody = try JSONEncoder().encode(body)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw HelperServiceError.invalidResponse
    }
    switch httpResponse.statusCode {
    case 200..<300:
      break
    case 401:
      throw HelperServiceError.unauthorized
    case 403:
      throw HelperServiceError.invalidPairingCode
    case 409:
      if let snapshot = try? JSONDecoder().decode(HelperSubscriptionSnapshot.self, from: data) {
        throw HelperServiceError.revisionConflict(snapshot)
      }
      if let snapshot = try? JSONDecoder().decode(HelperProfileSnapshot.self, from: data) {
        throw HelperServiceError.profileRevisionConflict(snapshot)
      }
      throw HelperServiceError.httpStatus(httpResponse.statusCode)
    default:
      throw HelperServiceError.httpStatus(httpResponse.statusCode)
    }

    do {
      return try JSONDecoder().decode(Response.self, from: data)
    } catch {
      throw HelperServiceError.invalidResponse
    }
  }

  private func endpoint(_ baseURL: URL, path: String) -> URL {
    baseURL.appending(path: path)
  }
}

actor DemoHelperService: HelperService {
  private struct State {
    var conflictInjected = false
    var jobs: [HelperJobStatus] = []
    var retriedEpisodeIDs: Set<String> = []
    var snapshot: HelperSubscriptionSnapshot
  }

  private var states: [String: State] = [:]
  private var profiles: [String: HelperProfileSnapshot] = [:]

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    HelperDiscoveryInfo(
      version: "2.0.0",
      capabilities: ["profile-sync-v1"],
      clientCount: 2,
      requiresPairingCode: true
    )
  }

  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential {
    guard code == "TV2026" else {
      throw HelperServiceError.invalidPairingCode
    }
    return HelperPairingCredential(clientID: clientID, token: "simulator-helper-token")
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    try authorize(token)
    let state = state(for: baseURL)
    return HelperStatus(
      version: "2.0.0",
      clientCount: 2,
      subscriptionCount: state.snapshot.replicas.count,
      pendingItems: runtimeEpisodes(in: state).count { ![.done, .skipped].contains($0.state) }
    )
  }

  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  {
    try authorize(token)
    return state(for: baseURL).snapshot
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    try authorize(token)
    return profileState(for: baseURL)
  }

  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    try authorize(token)
    let key = stateKey(for: baseURL)
    let current = profileState(for: baseURL)
    guard current.revision == revision else {
      throw HelperServiceError.profileRevisionConflict(current)
    }
    var records = Dictionary(uniqueKeysWithValues: current.records.map { ($0.key, $0) })
    for mutation in mutations {
      switch mutation.operation {
      case "set":
        guard let value = mutation.value else { continue }
        records[mutation.key] = HelperProfileRecord(
          key: mutation.key,
          value: value,
          secret: mutation.secret == true,
          updatedAt: ISO8601DateFormatter().string(from: .now),
          updatedBy: "ios-demo"
        )
      case "delete":
        records[mutation.key] = nil
      default:
        continue
      }
    }
    let updated = HelperProfileSnapshot(
      revision: current.revision + 1,
      records: records.values.sorted { $0.key < $1.key }
    )
    profiles[key] = updated
    return updated
  }

  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    try authorize(token)
    let key = stateKey(for: baseURL)
    var state = state(for: baseURL)
    guard revision == state.snapshot.revision else {
      throw HelperServiceError.revisionConflict(state.snapshot)
    }

    if shouldInjectConflict(at: baseURL), !state.conflictInjected {
      state.conflictInjected = true
      state.snapshot = HelperSubscriptionSnapshot(
        revision: state.snapshot.revision + 1,
        replicas: state.snapshot.replicas + [
          HelperReplica(
            id: "ipad-rain-radio",
            bangumiId: "4103",
            title: "雨后通信",
            bangumiSubjectId: "500003",
            subgroupId: "370",
            subgroupName: "LoliHouse",
            rssUrl: "https://mikanani.me/RSS/Bangumi?bangumiId=4103&subgroupid=370"
          )
        ]
      )
      states[key] = state
      throw HelperServiceError.revisionConflict(state.snapshot)
    }

    state.snapshot = HelperSubscriptionSnapshot(
      revision: state.snapshot.revision + 1,
      replicas: replicas
    )
    states[key] = state
    return state.snapshot
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    try authorize(token)
    let state = state(for: baseURL)
    return HelperRuntimeStatus(
      replicas: state.snapshot.replicas.map { replica in
        HelperReplicaStatus(
          id: replica.id,
          bangumiId: replica.bangumiId,
          title: replica.title,
          bangumiSubjectId: replica.bangumiSubjectId,
          subgroupId: replica.subgroupId,
          subgroupName: replica.subgroupName,
          rssUrl: replica.rssUrl,
          episodes: demoEpisodes(for: replica, retriedEpisodeIDs: state.retriedEpisodeIDs)
        )
      },
      jobs: state.jobs
    )
  }

  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    try authorize(token)
    let key = stateKey(for: baseURL)
    var state = state(for: baseURL)
    let statuses = episodes.map { episode in
      HelperEpisodeStatus(
        episodeId: episode.episodeId,
        title: episode.title,
        season: 1,
        episode: nil,
        state: .pending,
        infohash: nil,
        lastError: nil
      )
    }
    state.jobs.removeAll { $0.bangumiId == bangumiID && $0.subgroupId == subgroupID }
    state.jobs.append(
      HelperJobStatus(
        bangumiId: bangumiID,
        subgroupId: subgroupID,
        episodes: statuses
      )
    )
    states[key] = state
    return HelperBackfillResult(episodes: statuses)
  }

  func retry(
    at baseURL: URL,
    token: String,
    request: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    try authorize(token)
    let key = stateKey(for: baseURL)
    var state = state(for: baseURL)
    state.retriedEpisodeIDs.insert(request.episodeId)
    states[key] = state
    let episode = HelperEpisodeStatus(
      episodeId: request.episodeId,
      title: request.title ?? "重试剧集",
      season: 1,
      episode: 2,
      state: .pending,
      infohash: nil,
      lastError: nil
    )
    return HelperBackfillResult(episodes: [episode])
  }

  func unpair(at baseURL: URL, token: String) async throws {}

  private func state(for baseURL: URL) -> State {
    let key = stateKey(for: baseURL)
    if let state = states[key] {
      return state
    }

    let snapshot: HelperSubscriptionSnapshot
    if isSecondaryServer(baseURL) {
      snapshot = HelperSubscriptionSnapshot(revision: 2, replicas: [])
    } else {
      snapshot = HelperSubscriptionSnapshot(
        revision: 4,
        replicas: [
          HelperReplica(
            id: "desktop-star-train",
            bangumiId: "4102",
            title: "星海列车",
            bangumiSubjectId: "500002",
            subgroupId: "583",
            subgroupName: "ANi",
            rssUrl: "https://mikanani.me/RSS/Bangumi?bangumiId=4102&subgroupid=583"
          )
        ]
      )
    }
    let state = State(snapshot: snapshot)
    states[key] = state
    return state
  }

  private func profileState(for baseURL: URL) -> HelperProfileSnapshot {
    let key = stateKey(for: baseURL)
    if let profile = profiles[key] {
      return profile
    }
    let records = [
      HelperProfileRecord(
        key: "discover.mteam.enabled",
        value: "true",
        secret: false,
        updatedAt: "2026-08-19T12:00:00Z",
        updatedBy: "desktop-demo"
      ),
      HelperProfileRecord(
        key: "discover.mteam.baseUrl",
        value: "https://api.m-team.cc/api",
        secret: false,
        updatedAt: "2026-08-19T12:00:00Z",
        updatedBy: "desktop-demo"
      ),
      HelperProfileRecord(
        key: "discover.mteam.apiKey",
        value: "demo-mteam-key",
        secret: true,
        updatedAt: "2026-08-19T12:00:00Z",
        updatedBy: "desktop-demo"
      ),
      HelperProfileRecord(
        key: "ai.openai.apiKey",
        value: "demo-openai-key",
        secret: true,
        updatedAt: "2026-08-19T12:00:00Z",
        updatedBy: "desktop-demo"
      ),
    ]
    let profile = HelperProfileSnapshot(revision: 3, records: records)
    profiles[key] = profile
    return profile
  }

  private func stateKey(for baseURL: URL) -> String {
    baseURL.host(percentEncoded: false)?.lowercased() ?? baseURL.absoluteString
  }

  private func isSecondaryServer(_ baseURL: URL) -> Bool {
    stateKey(for: baseURL).contains("mac")
  }

  private func shouldInjectConflict(at baseURL: URL) -> Bool {
    !isSecondaryServer(baseURL)
  }

  private func runtimeEpisodes(in state: State) -> [HelperEpisodeStatus] {
    state.snapshot.replicas.flatMap {
      demoEpisodes(for: $0, retriedEpisodeIDs: state.retriedEpisodeIDs)
    } + state.jobs.flatMap(\.episodes)
  }

  private func demoEpisodes(
    for replica: HelperReplica,
    retriedEpisodeIDs: Set<String>
  ) -> [HelperEpisodeStatus] {
    guard replica.id == "desktop-star-train" else {
      return [
        HelperEpisodeStatus(
          episodeId: "\(replica.id)-01",
          title: "\(replica.title) - 01",
          season: 1,
          episode: 1,
          state: .pending,
          infohash: nil,
          lastError: nil
        )
      ]
    }
    let episodeID = "star-train-02"
    return [
      HelperEpisodeStatus(
        episodeId: episodeID,
        title: "[ANi] 星海列车 - 02 [1080P]",
        season: 1,
        episode: 2,
        state: retriedEpisodeIDs.contains(episodeID) ? .pending : .failed,
        infohash: nil,
        lastError: retriedEpisodeIDs.contains(episodeID) ? nil : "qBittorrent 暂时不可达"
      )
    ]
  }

  private func authorize(_ token: String) throws {
    guard !token.isEmpty else { throw HelperServiceError.unauthorized }
  }
}

enum HelperServiceError: LocalizedError, Equatable {
  case httpStatus(Int)
  case invalidPairingCode
  case invalidResponse
  case profileRevisionConflict(HelperProfileSnapshot)
  case revisionConflict(HelperSubscriptionSnapshot)
  case unauthorized
  case unsupportedProtocol

  var errorDescription: String? {
    switch self {
    case .httpStatus(let status):
      "Helper 请求失败（HTTP \(status)）。"
    case .invalidPairingCode:
      "配对码无效或已经过期。"
    case .invalidResponse:
      "Helper 返回了无法识别的数据。"
    case .profileRevisionConflict:
      "Helper 凭证 Profile 已被其他客户端更新。"
    case .revisionConflict:
      "Helper 订阅已被其他客户端更新。"
    case .unauthorized:
      "此设备的 Helper 授权已失效，请重新配对。"
    case .unsupportedProtocol:
      "Helper 版本不支持独立客户端配对，请先升级 Helper。"
    }
  }
}

private struct DiscoverPayload: Decodable {
  let version: String
  let capabilities: [String]?
  let clientCount: Int
  let requiresPairingCode: Bool
}

private struct UpdateProfileRequest: Encodable {
  let revision: UInt64
  let mutations: [HelperProfileMutation]
}

private struct PairRequest: Encodable {
  let code: String
  let clientId: String
  let clientName: String
}

private struct PairPayload: Decodable {
  let clientId: String
  let token: String
}

private struct ReplaceSubscriptionsRequest: Encodable {
  let revision: UInt64
  let replicas: [HelperReplica]
}

private struct BackfillRequest: Encodable {
  let bangumiId: String
  let subgroupId: String
  let episodes: [HelperBackfillEpisode]
}

private struct NoBody: Encodable {}

private struct EmptyResponse: Decodable {
  init(from decoder: Decoder) throws {
    _ = try? decoder.singleValueContainer()
  }
}
