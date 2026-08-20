import Foundation

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
      capabilities: ["profile-sync-v1", "events", "logs", "check"],
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

  func events(
    at baseURL: URL,
    token: String,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    try authorize(token)
    return HelperEventsPage(events: [], cursor: 0)
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    try authorize(token)
    return ""
  }

  func check(at baseURL: URL, token: String) async throws {
    try authorize(token)
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
