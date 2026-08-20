import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class AppModel {
  private(set) var servers: [ServerConfiguration]
  private(set) var activeServerID: UUID?
  private(set) var torrents: [TorrentSummary] = []
  private(set) var isRefreshing = false
  private(set) var lastUpdated: Date?
  private(set) var integrationNotice: String?
  private(set) var totalDownloadSpeed = "—"
  private(set) var totalUploadSpeed = "—"
  private(set) var serverConnectionStates: [UUID: ServerConnectionState] = [:]
  private(set) var helperConnectionStates: [UUID: HelperConnectionState] = [:]
  private(set) var helperSubscriptionStates: [UUID: HelperSubscriptionLoadState] = [:]

  let isDemoMode: Bool

  private let credentialStore: any ServerCredentialStore
  private let helperCredentialStore: any HelperCredentialStore
  private let helperService: any HelperService
  private let helperSubscriptionCoordinator: HelperSubscriptionCoordinator
  private let helperClientID: String
  private let torrentRepository: any TorrentRepository
  private let defaults: UserDefaults
  private static let serversStorageKey = "torrentVibe.servers"
  private static let activeServerStorageKey = "torrentVibe.activeServer"
  private static let helperClientIDStorageKey = "torrentVibe.helper.clientID"
  private static let helperCacheStorageKeyPrefix = "torrentVibe.helper.cache."
  private static let demoServerID = UUID(uuidString: "8ED0F2A8-F72B-49E2-B2D2-22671F367995")!
  private static let demoSecondaryServerID = UUID(
    uuidString: "A925BB90-A242-48DA-B984-6DA12D56DB1E"
  )!

  private static let mikanActiveEpisodeStates: Set<HelperEpisodeState> = [
    .pending, .added, .downloading, .renaming,
  ]
  private static let mikanActivePollInterval: Duration = .seconds(5)
  private static let mikanSettledPollInterval: Duration = .seconds(30)

  private let mikanPollIntervalOverride: Duration?
  private var isMikanSurfaceVisible = false
  private var isAppActiveForMikanPolling = true
  private var isMikanPollInFlight = false
  private var mikanPollTimerTask: Task<Void, Never>?
  private var mikanPollInFlightTask: Task<Void, Never>?
  private var mikanBackgroundObserver: NSObjectProtocol?
  private var mikanForegroundObserver: NSObjectProtocol?

  init(
    launchArguments: [String] = ProcessInfo.processInfo.arguments,
    defaults: UserDefaults = .standard,
    credentialStore: any ServerCredentialStore = KeychainServerCredentialStore(),
    helperCredentialStore: any HelperCredentialStore = KeychainHelperCredentialStore(),
    helperService: (any HelperService)? = nil,
    torrentRepository: (any TorrentRepository)? = nil,
    mikanPollIntervalOverride: Duration? = nil
  ) {
    let demoMode = launchArguments.contains("-ui-demo")
    isDemoMode = demoMode
    self.defaults = defaults
    self.mikanPollIntervalOverride = mikanPollIntervalOverride
    self.credentialStore = credentialStore
    self.helperCredentialStore = helperCredentialStore
    let resolvedHelperService: any HelperService =
      helperService ?? (demoMode ? DemoHelperService() : URLSessionHelperService())
    self.helperService = resolvedHelperService
    helperSubscriptionCoordinator = HelperSubscriptionCoordinator(service: resolvedHelperService)
    helperClientID = Self.loadOrCreateHelperClientID(from: defaults)
    self.torrentRepository =
      torrentRepository
      ?? (demoMode
        ? DemoTorrentRepository()
        : QBittorrentTorrentRepository(credentialStore: credentialStore))

    if demoMode {
      let demoServer = ServerConfiguration(
        id: Self.demoServerID,
        name: "家庭 NAS",
        baseURL: URL(string: "https://nas.example.test:8080")!,
        username: "demo",
        helperBaseURL: URL(string: "http://nas.example.test:17890")
      )
      let demoSecondaryServer = ServerConfiguration(
        id: Self.demoSecondaryServerID,
        name: "书房 Mac",
        baseURL: URL(string: "https://mac.example.test:8080")!,
        username: "demo",
        helperBaseURL: URL(string: "http://mac.example.test:17890")
      )
      servers = [demoServer, demoSecondaryServer]
      activeServerID = demoServer.id
      totalDownloadSpeed = "18.4 MB/s"
      totalUploadSpeed = "5.9 MB/s"
      if launchArguments.contains("-ui-helper-reset") {
        try? helperCredentialStore.deleteToken(for: demoServer.id)
        try? helperCredentialStore.deleteToken(for: demoSecondaryServer.id)
      } else if launchArguments.contains("-ui-helper-demo-paired") {
        try? helperCredentialStore.setToken("simulator-helper-token", for: demoServer.id)
        try? helperCredentialStore.setToken(
          "simulator-helper-token-secondary",
          for: demoSecondaryServer.id
        )
      }
    } else {
      servers = Self.loadServers(from: defaults)
      activeServerID = Self.loadActiveServerID(from: defaults)

      if activeServerID.flatMap({ activeID in servers.first { $0.id == activeID } }) == nil {
        activeServerID = servers.first?.id
      }
    }
  }

  var activeServer: ServerConfiguration? {
    guard let activeServerID else { return nil }
    return servers.first { $0.id == activeServerID }
  }

  var pairedHelperServers: [ServerConfiguration] {
    servers.filter { server in
      server.helperBaseURL != nil && hasStoredHelperToken(for: server.id)
    }
  }

  var helperSubscriptionVisibleServers: [ServerConfiguration] {
    servers.filter { server in
      guard server.helperBaseURL != nil else { return false }
      if hasStoredHelperToken(for: server.id) { return true }
      return helperSubscriptionStates[server.id] == .needsRepairing
    }
  }

  var helperSubscriptionGroups: [HelperSubscriptionGroup] {
    var groups: [String: (replica: HelperReplica, targets: [HelperSubscriptionTarget])] = [:]

    for server in pairedHelperServers {
      guard case .loaded(let snapshot, let status, let source) = helperSubscriptionState(for: server.id)
      else { continue }

      for replica in snapshot.replicas {
        let key = "\(replica.bangumiId):\(replica.subgroupId)"
        let runtime = status.replicas.first {
          $0.id == replica.id
            || ($0.bangumiId == replica.bangumiId && $0.subgroupId == replica.subgroupId)
        }
        let target = HelperSubscriptionTarget(
          serverID: server.id,
          serverName: server.name,
          replicaID: replica.id,
          episodes: runtime?.episodes ?? [],
          source: source,
          checkedAt: runtime?.checkedAt,
          checkError: runtime?.checkError,
          consecutiveFailures: runtime?.consecutiveFailures
        )
        if var existing = groups[key] {
          existing.targets.append(target)
          groups[key] = existing
        } else {
          groups[key] = (replica, [target])
        }
      }
    }

    return groups.values
      .map { value in
        HelperSubscriptionGroup(
          replica: value.replica,
          targets: value.targets
        )
      }
      .sorted { $0.replica.title.localizedCompare($1.replica.title) == .orderedAscending }
  }

  func helperSubscriptionGroup(bangumiID: String, subgroupID: String) -> HelperSubscriptionGroup? {
    helperSubscriptionGroups.first {
      $0.replica.bangumiId == bangumiID && $0.replica.subgroupId == subgroupID
    }
  }

  func mikanSubscriptionBarInput(bangumiID: String, subgroupID: String) -> MikanSubscriptionBarInput? {
    let group = helperSubscriptionGroup(bangumiID: bangumiID, subgroupID: subgroupID)

    var targets: [MikanSubscriptionBarTarget] =
      (group?.targets ?? []).map { target in
        MikanSubscriptionBarTarget(
          serverName: target.serverName,
          source: target.source,
          checkedAt: target.checkedAt,
          checkError: target.checkError,
          consecutiveFailures: target.consecutiveFailures,
          needsRepairing: false
        )
      }

    for server in helperSubscriptionVisibleServers
    where helperSubscriptionState(for: server.id) == .needsRepairing {
      guard let cached = loadHelperCache(for: server.id),
        cached.snapshot.replicas.contains(where: {
          $0.bangumiId == bangumiID && $0.subgroupId == subgroupID
        })
      else { continue }
      targets.append(
        MikanSubscriptionBarTarget(
          serverName: server.name,
          source: .cache,
          needsRepairing: true
        )
      )
    }

    guard !targets.isEmpty else { return nil }

    let progress = group.map { MikanSubscriptionBarModel.progress(from: $0.targets) }
      ?? MikanSubscriptionBarProgress(ready: 0, total: 0, failed: 0)
    return MikanSubscriptionBarInput(targets: targets, progress: progress)
  }

  func helperEpisodeStatus(
    bangumiID: String,
    subgroupID: String,
    episodeID: String
  ) -> HelperEpisodeStatus? {
    guard let group = helperSubscriptionGroup(bangumiID: bangumiID, subgroupID: subgroupID) else {
      return nil
    }
    let preferred = group.targets.first { $0.serverID == activeServerID } ?? group.targets.first
    return preferred?.episodes.first { $0.episodeId == episodeID }
  }

  func selectServer(_ server: ServerConfiguration) {
    activeServerID = server.id
    torrents = []
    integrationNotice = nil
    totalDownloadSpeed = "—"
    totalUploadSpeed = "—"
    persistActiveServerID()
  }

  func addServer(
    name: String,
    baseURLText: String,
    username: String,
    password: String,
    helperURLText: String
  ) throws {
    let draft = try Self.validatedServerDraft(
      name: name,
      baseURLText: baseURLText,
      username: username,
      password: password,
      helperURLText: helperURLText
    )
    guard !draft.password.isEmpty else {
      throw ServerValidationError.missingPassword
    }

    let server = ServerConfiguration(
      name: draft.name,
      baseURL: draft.baseURL,
      username: draft.username,
      helperBaseURL: draft.helperURL
    )

    try credentialStore.setPassword(draft.password, for: server.id)
    servers.append(server)
    activeServerID = server.id
    persistServers()
    persistActiveServerID()
  }

  func updateServer(
    id: UUID,
    name: String,
    baseURLText: String,
    username: String,
    password: String,
    helperURLText: String
  ) throws {
    guard let index = servers.firstIndex(where: { $0.id == id }) else {
      throw ServerValidationError.serverUnavailable
    }

    let draft = try Self.validatedServerDraft(
      name: name,
      baseURLText: baseURLText,
      username: username,
      password: password,
      helperURLText: helperURLText
    )
    if draft.password.isEmpty {
      guard hasStoredPassword(for: id) else {
        throw ServerValidationError.missingPassword
      }
    } else {
      try credentialStore.setPassword(draft.password, for: id)
    }

    let previous = servers[index]
    servers[index].name = draft.name
    servers[index].baseURL = draft.baseURL
    servers[index].username = draft.username
    servers[index].helperBaseURL = draft.helperURL

    if previous.baseURL != draft.baseURL || previous.username != draft.username
      || !draft.password.isEmpty
    {
      serverConnectionStates[id] = .idle
      if id == activeServerID {
        torrents = []
        integrationNotice = nil
        totalDownloadSpeed = "—"
        totalUploadSpeed = "—"
      }
    }

    if previous.helperBaseURL != draft.helperURL {
      try? helperCredentialStore.deleteToken(for: id)
      helperConnectionStates[id] = .idle
      helperSubscriptionStates[id] = nil
    }

    persistServers()
  }

  func removeServers(atOffsets offsets: IndexSet) {
    let removedIDs = offsets.compactMap { index in
      servers.indices.contains(index) ? servers[index].id : nil
    }
    for index in offsets.sorted(by: >) where servers.indices.contains(index) {
      servers.remove(at: index)
    }

    if let activeServerID, removedIDs.contains(activeServerID) {
      self.activeServerID = servers.first?.id
      torrents = []
    }

    persistServers()
    persistActiveServerID()
  }

  func removeServer(id: UUID) {
    guard let index = servers.firstIndex(where: { $0.id == id }) else { return }
    try? credentialStore.deletePassword(for: id)
    try? helperCredentialStore.deleteToken(for: id)
    serverConnectionStates[id] = nil
    helperConnectionStates[id] = nil
    helperSubscriptionStates[id] = nil
    clearHelperCache(for: id)
    removeServers(atOffsets: IndexSet(integer: index))
  }

  func hasStoredPassword(for serverID: UUID) -> Bool {
    guard let password = try? credentialStore.password(for: serverID) else { return false }
    return !password.isEmpty
  }

  func connectionStatusText(for serverID: UUID) -> String {
    switch serverConnectionStates[serverID] ?? .idle {
    case .idle:
      "尚未测试"
    case .connecting:
      "正在连接"
    case .connected(let version):
      version.map { "已连接 · \($0)" } ?? "已连接"
    case .failed(let message):
      message
    }
  }

  func helperConnectionState(for serverID: UUID) -> HelperConnectionState {
    helperConnectionStates[serverID] ?? .idle
  }

  func helperStatusText(for serverID: UUID) -> String {
    guard let server = servers.first(where: { $0.id == serverID }) else {
      return "未配置"
    }
    switch helperConnectionState(for: serverID) {
    case .connected(let status):
      return "已连接 · v\(status.version)"
    case .connecting:
      return "正在连接"
    case .failed(let message):
      return message
    case .idle:
      if hasStoredHelperToken(for: serverID) {
        return "已配对"
      }
      return server.helperBaseURL == nil ? "未配置" : "未配对"
    }
  }

  func hasStoredHelperToken(for serverID: UUID) -> Bool {
    do {
      return try helperCredentialStore.token(for: serverID)?.isEmpty == false
    } catch {
      return false
    }
  }

  func refreshHelperStatus(for serverID: UUID) async {
    guard let server = servers.first(where: { $0.id == serverID }),
      let baseURL = server.helperBaseURL
    else {
      helperConnectionStates[serverID] = .idle
      return
    }

    let token: String
    do {
      guard let storedToken = try helperCredentialStore.token(for: serverID), !storedToken.isEmpty
      else {
        helperConnectionStates[serverID] = .idle
        return
      }
      token = storedToken
    } catch {
      helperConnectionStates[serverID] = .failed(error.localizedDescription)
      return
    }

    helperConnectionStates[serverID] = .connecting
    do {
      let status = try await helperService.status(at: baseURL, token: token)
      helperConnectionStates[serverID] = .connected(status)
    } catch {
      if error as? HelperServiceError == .unauthorized {
        try? helperCredentialStore.deleteToken(for: serverID)
      }
      helperConnectionStates[serverID] = .failed(error.localizedDescription)
    }
  }

  func helperProfile(for serverID: UUID) async throws -> HelperProfileSnapshot {
    let authorization = try helperAuthorization(for: serverID)
    return try await helperService.profile(
      at: authorization.baseURL,
      token: authorization.token
    )
  }

  func updateHelperProfile(
    for serverID: UUID,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    let authorization = try helperAuthorization(for: serverID)
    return try await helperService.updateProfile(
      at: authorization.baseURL,
      token: authorization.token,
      revision: revision,
      mutations: mutations
    )
  }

  func helperDiscoveryInfo(for serverID: UUID) async throws -> HelperDiscoveryInfo {
    let authorization = try helperAuthorization(for: serverID)
    return try await helperService.discover(at: authorization.baseURL)
  }

  func helperEvents(
    for serverID: UUID,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    let authorization = try helperAuthorization(for: serverID)
    return try await helperService.events(
      at: authorization.baseURL,
      token: authorization.token,
      since: since,
      level: level,
      replicaID: replicaID,
      limit: limit
    )
  }

  func helperLogs(for serverID: UUID, tail: Int?) async throws -> String {
    let authorization = try helperAuthorization(for: serverID)
    return try await helperService.logs(
      at: authorization.baseURL,
      token: authorization.token,
      tail: tail
    )
  }

  func pairHelper(serverID: UUID, baseURLText: String, pairingCode: String) async {
    guard let index = servers.firstIndex(where: { $0.id == serverID }) else { return }
    helperConnectionStates[serverID] = .connecting
    do {
      let baseURL = try Self.validatedHTTPURL(baseURLText, fieldName: "Helper 地址")
      let code =
        pairingCode
        .uppercased()
        .filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
      guard code.count == 6 else {
        throw HelperPairingError.invalidCode
      }

      _ = try await helperService.discover(at: baseURL)
      let credential = try await helperService.pair(
        at: baseURL,
        code: code,
        clientID: helperClientID,
        clientName: "Torrent Vibe iOS"
      )
      do {
        try helperCredentialStore.setToken(credential.token, for: serverID)
      } catch {
        try? await helperService.unpair(at: baseURL, token: credential.token)
        throw error
      }
      servers[index].helperBaseURL = baseURL
      persistServers()

      let status = try await helperService.status(at: baseURL, token: credential.token)
      helperConnectionStates[serverID] = .connected(status)
    } catch {
      helperConnectionStates[serverID] = .failed(error.localizedDescription)
    }
  }

  func unpairHelper(for serverID: UUID) async {
    guard let server = servers.first(where: { $0.id == serverID }) else { return }
    helperConnectionStates[serverID] = .connecting
    do {
      if let baseURL = server.helperBaseURL,
        let token = try helperCredentialStore.token(for: serverID),
        !token.isEmpty
      {
        do {
          try await helperService.unpair(at: baseURL, token: token)
        } catch HelperServiceError.unauthorized {
          // A previously revoked credential is already unpaired remotely.
        }
      }
      try helperCredentialStore.deleteToken(for: serverID)
      helperConnectionStates[serverID] = .idle
      helperSubscriptionStates[serverID] = nil
    } catch {
      helperConnectionStates[serverID] = .failed(error.localizedDescription)
    }
  }

  func helperSubscriptionState(for serverID: UUID) -> HelperSubscriptionLoadState {
    helperSubscriptionStates[serverID] ?? .idle
  }

  var trackedMikanEpisodeStates: [HelperEpisodeState] {
    helperSubscriptionGroups.flatMap { group in
      group.targets.flatMap { $0.episodes.map(\.state) }
    }
  }

  static func mikanPollingInterval(forEpisodeStates states: [HelperEpisodeState]) -> Duration {
    states.contains { mikanActiveEpisodeStates.contains($0) }
      ? mikanActivePollInterval
      : mikanSettledPollInterval
  }

  func startMikanPolling() {
    isMikanSurfaceVisible = true
    observeMikanAppLifecycleIfNeeded()
    evaluateMikanPollingSchedule()
  }

  func stopMikanPolling() {
    isMikanSurfaceVisible = false
    teardownMikanPolling()
  }

  var isObservingMikanAppLifecycle: Bool {
    mikanBackgroundObserver != nil || mikanForegroundObserver != nil
  }

  func refreshAllHelperSubscriptions() async {
    let pairedIDs = Set(pairedHelperServers.map(\.id))
    helperSubscriptionStates = helperSubscriptionStates.filter { serverID, state in
      pairedIDs.contains(serverID) || state == .needsRepairing
    }
    for server in pairedHelperServers {
      await refreshHelperSubscriptions(for: server.id)
    }
  }

  func refreshHelperSubscriptions(for serverID: UUID) async {
    switch helperSubscriptionStates[serverID] {
    case .loaded, .loading:
      break
    case .failed, .idle, .needsRepairing, nil:
      helperSubscriptionStates[serverID] = .loading
    }
    do {
      let authorization = try helperAuthorization(for: serverID)
      async let snapshot = helperService.subscriptions(
        at: authorization.baseURL,
        token: authorization.token
      )
      async let status = helperService.runtimeStatus(
        at: authorization.baseURL,
        token: authorization.token
      )
      let loaded = try await (snapshot, status)
      applyLoadedHelperSubscriptions(serverID: serverID, snapshot: loaded.0, status: loaded.1)
    } catch {
      if error as? HelperServiceError == .unauthorized {
        try? helperCredentialStore.deleteToken(for: serverID)
        helperSubscriptionStates[serverID] = .needsRepairing
      } else if let cached = loadHelperCache(for: serverID) {
        helperSubscriptionStates[serverID] = .loaded(
          snapshot: cached.snapshot,
          status: cached.status,
          source: .cache
        )
      } else {
        helperSubscriptionStates[serverID] = .failed(error.localizedDescription)
      }
    }
  }

  func subscribeToMikan(
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    baseURL: URL,
    serverIDs: Set<UUID>
  ) async throws -> HelperSubscriptionOutcome {
    guard !serverIDs.isEmpty else { throw HelperContentError.noTarget }
    let rssURL = try Self.mikanRSSURL(
      baseURL: baseURL,
      bangumiID: detail.bangumiId,
      subgroupID: subgroup.id
    )
    let replica = HelperReplica(
      id: "mikan:\(detail.bangumiId):\(subgroup.id)",
      bangumiId: detail.bangumiId,
      title: detail.title,
      bangumiSubjectId: detail.bangumiSubjectId,
      subgroupId: subgroup.id,
      subgroupName: subgroup.name,
      rssUrl: rssURL.absoluteString
    )

    var serverNames: [String] = []
    var pushedServerIDs: [UUID] = []
    var mergedConflict = false
    var lastPushError: Error?
    for serverID in serverIDs.sorted(by: { $0.uuidString < $1.uuidString }) {
      do {
        let authorization = try helperAuthorization(for: serverID)
        let mutation = try await helperSubscriptionCoordinator.upsert(
          replica,
          at: authorization.baseURL,
          token: authorization.token
        )
        mergedConflict = mergedConflict || mutation.mergedConflict
        let status = try await helperService.runtimeStatus(
          at: authorization.baseURL,
          token: authorization.token
        )
        applyLoadedHelperSubscriptions(
          serverID: serverID,
          snapshot: mutation.snapshot,
          status: status
        )
        serverNames.append(authorization.server.name)
        pushedServerIDs.append(serverID)
      } catch {
        handleHelperContentError(error, serverID: serverID)
        lastPushError = error
      }
    }

    guard !pushedServerIDs.isEmpty else {
      throw lastPushError ?? HelperContentError.serverUnavailable
    }

    let backfillFailed = await backfillAfterSubscribe(
      detail: detail,
      subgroup: subgroup,
      serverIDs: pushedServerIDs
    )

    return HelperSubscriptionOutcome(
      serverNames: serverNames,
      mergedConflict: mergedConflict,
      backfillFailed: backfillFailed
    )
  }

  private func backfillAfterSubscribe(
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    serverIDs: [UUID]
  ) async -> Bool {
    let episodes = Self.backfillEpisodes(in: detail, subgroup: subgroup)
    guard !episodes.isEmpty else { return false }

    var backfillFailed = false
    for serverID in serverIDs {
      do {
        let authorization = try helperAuthorization(for: serverID)
        _ = try await helperService.backfill(
          at: authorization.baseURL,
          token: authorization.token,
          bangumiID: detail.bangumiId,
          subgroupID: subgroup.id,
          episodes: episodes
        )
      } catch {
        backfillFailed = true
      }
      await refreshHelperSubscriptions(for: serverID)
    }
    return backfillFailed
  }

  private static func backfillEpisodes(
    in detail: MikanBangumiDetail,
    subgroup: MikanSubgroup
  ) -> [HelperBackfillEpisode] {
    detail.episodes
      .filter { $0.subgroupId == subgroup.id }
      .map { episode in
        HelperBackfillEpisode(
          episodeId: episode.episodeId,
          title: episode.title,
          torrentUrl: episode.torrentUrl,
          publishedAt: episode.publishedAt,
          sizeBytes: episode.sizeBytes
        )
      }
  }

  func updateMikanSubscriptionTargets(
    group: HelperSubscriptionGroup,
    targetServerIDs: Set<UUID>
  ) async throws -> HelperSubscriptionOutcome {
    guard !targetServerIDs.isEmpty else { throw HelperContentError.noTarget }

    var mergedConflict = false
    let addedServerIDs = targetServerIDs.subtracting(group.targetServerIDs)
    for serverID in addedServerIDs.sorted(by: { $0.uuidString < $1.uuidString }) {
      let authorization = try helperAuthorization(for: serverID)
      do {
        let mutation = try await helperSubscriptionCoordinator.upsert(
          group.replica,
          at: authorization.baseURL,
          token: authorization.token
        )
        mergedConflict = mergedConflict || mutation.mergedConflict
        let status = try await helperService.runtimeStatus(
          at: authorization.baseURL,
          token: authorization.token
        )
        applyLoadedHelperSubscriptions(
          serverID: serverID,
          snapshot: mutation.snapshot,
          status: status
        )
      } catch {
        handleHelperContentError(error, serverID: serverID)
        throw error
      }
    }

    let removedTargets = group.targets.filter { !targetServerIDs.contains($0.serverID) }
    for target in removedTargets.sorted(by: { $0.serverID.uuidString < $1.serverID.uuidString }) {
      let authorization = try helperAuthorization(for: target.serverID)
      do {
        let mutation = try await helperSubscriptionCoordinator.remove(
          replicaID: target.replicaID,
          at: authorization.baseURL,
          token: authorization.token
        )
        mergedConflict = mergedConflict || mutation.mergedConflict
        let status = try await helperService.runtimeStatus(
          at: authorization.baseURL,
          token: authorization.token
        )
        applyLoadedHelperSubscriptions(
          serverID: target.serverID,
          snapshot: mutation.snapshot,
          status: status
        )
      } catch {
        handleHelperContentError(error, serverID: target.serverID)
        throw error
      }
    }

    let names =
      pairedHelperServers
      .filter { targetServerIDs.contains($0.id) }
      .map(\.name)
    return HelperSubscriptionOutcome(
      serverNames: names, mergedConflict: mergedConflict, backfillFailed: false)
  }

  func retryHelperEpisode(
    serverID: UUID,
    bangumiID: String,
    subgroupID: String,
    episode: HelperEpisodeStatus
  ) async throws {
    let authorization = try helperAuthorization(for: serverID)
    do {
      _ = try await helperService.retry(
        at: authorization.baseURL,
        token: authorization.token,
        request: HelperRetryRequest(
          bangumiId: bangumiID,
          subgroupId: subgroupID,
          episodeId: episode.episodeId,
          title: episode.title,
          torrentUrl: nil
        )
      )
      await refreshHelperSubscriptions(for: serverID)
    } catch {
      handleHelperContentError(error, serverID: serverID)
      throw error
    }
  }

  func unsubscribeFromHelper(serverID: UUID, replicaID: String) async throws {
    let authorization = try helperAuthorization(for: serverID)
    do {
      let mutation = try await helperSubscriptionCoordinator.remove(
        replicaID: replicaID,
        at: authorization.baseURL,
        token: authorization.token
      )
      let status = try await helperService.runtimeStatus(
        at: authorization.baseURL,
        token: authorization.token
      )
      applyLoadedHelperSubscriptions(serverID: serverID, snapshot: mutation.snapshot, status: status)
    } catch {
      handleHelperContentError(error, serverID: serverID)
      throw error
    }
  }

  func unsubscribeMikanSubscription(_ group: HelperSubscriptionGroup) async throws {
    for target in group.targets {
      try await unsubscribeFromHelper(
        serverID: target.serverID,
        replicaID: target.replicaID
      )
    }
  }

  func testConnection(for server: ServerConfiguration) async {
    await loadSnapshot(for: server, applyTorrents: server.id == activeServerID)
  }

  @discardableResult
  func addTorrent(
    _ request: TorrentAddRequest,
    to serverID: UUID
  ) async throws -> ServerConfiguration {
    let request = try Self.validatedTorrentAddRequest(request)
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentImportError.serverUnavailable
    }

    try await torrentRepository.addTorrent(request, to: server)
    if server.id == activeServerID {
      try? await Task.sleep(for: .milliseconds(500))
      await loadSnapshot(for: server, applyTorrents: true)
    }
    return server
  }

  @discardableResult
  func setTorrentPaused(
    torrentID: String,
    paused: Bool,
    serverID: UUID
  ) async throws -> TorrentSummary {
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    try await torrentRepository.setPaused(
      paused,
      torrentIDs: [torrentID],
      on: server
    )

    if server.id == activeServerID {
      await loadSnapshot(for: server, applyTorrents: true)
      guard let updated = torrents.first(where: { $0.id == torrentID }) else {
        throw TorrentActionError.torrentUnavailable
      }
      return updated
    }
    throw TorrentActionError.torrentUnavailable
  }

  func setTorrentsPaused(
    torrentIDs: [String],
    paused: Bool,
    serverID: UUID
  ) async throws {
    let torrentIDs = try Self.validatedTorrentIDs(torrentIDs)
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    try await torrentRepository.setPaused(
      paused,
      torrentIDs: torrentIDs,
      on: server
    )
    if server.id == activeServerID {
      await loadSnapshot(for: server, applyTorrents: true)
    }
  }

  @discardableResult
  func toggleTorrentDownloadStrategy(
    _ strategy: TorrentDownloadStrategy,
    torrentID: String,
    serverID: UUID
  ) async throws -> TorrentSummary {
    let torrentIDs = try Self.validatedTorrentIDs([torrentID])
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    try await torrentRepository.toggleDownloadStrategy(
      strategy,
      torrentIDs: torrentIDs,
      on: server
    )
    if server.id == activeServerID {
      await loadSnapshot(for: server, applyTorrents: true)
      guard let updated = torrents.first(where: { $0.id == torrentID }) else {
        throw TorrentActionError.torrentUnavailable
      }
      return updated
    }
    throw TorrentActionError.torrentUnavailable
  }

  func deleteTorrents(
    torrentIDs: [String],
    deleteFiles: Bool,
    serverID: UUID
  ) async throws {
    let torrentIDs = try Self.validatedTorrentIDs(torrentIDs)
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    try await torrentRepository.deleteTorrents(
      ids: torrentIDs,
      deleteFiles: deleteFiles,
      on: server
    )
    if server.id == activeServerID {
      await loadSnapshot(for: server, applyTorrents: true)
    }
  }

  @discardableResult
  func updateTorrentManagement(
    torrentID: String,
    request: TorrentManagementRequest,
    serverID: UUID
  ) async throws -> TorrentSummary {
    let request = try Self.validatedTorrentManagementRequest(request)
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    try await torrentRepository.updateTorrents(
      ids: [torrentID],
      request: request,
      on: server
    )
    if server.id == activeServerID {
      await loadSnapshot(for: server, applyTorrents: true)
      guard let updated = torrents.first(where: { $0.id == torrentID }) else {
        throw TorrentActionError.torrentUnavailable
      }
      return updated
    }
    throw TorrentActionError.torrentUnavailable
  }

  func torrentFiles(torrentID: String, serverID: UUID) async throws
    -> [TorrentFileSummary]
  {
    let server = try torrentServer(for: serverID)
    return try await torrentRepository.files(for: torrentID, on: server)
  }

  func torrentTrackers(torrentID: String, serverID: UUID) async throws
    -> [TorrentTrackerSummary]
  {
    let server = try torrentServer(for: serverID)
    return try await torrentRepository.trackers(for: torrentID, on: server)
  }

  func torrentPeers(torrentID: String, serverID: UUID) async throws
    -> [TorrentPeerSummary]
  {
    let server = try torrentServer(for: serverID)
    return try await torrentRepository.peers(for: torrentID, on: server)
  }

  func refreshTorrents() async {
    guard !isRefreshing else { return }
    guard let activeServer else {
      torrents = []
      integrationNotice = nil
      return
    }

    await loadSnapshot(for: activeServer, applyTorrents: true)
  }

  private func loadSnapshot(for server: ServerConfiguration, applyTorrents: Bool) async {
    isRefreshing = true
    serverConnectionStates[server.id] = .connecting
    defer { isRefreshing = false }

    do {
      let snapshot = try await torrentRepository.snapshot(for: server)
      if applyTorrents {
        torrents = snapshot.torrents
        totalDownloadSpeed = snapshot.totalDownloadSpeed
        totalUploadSpeed = snapshot.totalUploadSpeed
        integrationNotice = nil
        lastUpdated = .now
        await TorrentLiveActivityCoordinator.shared.synchronize(
          torrents: snapshot.torrents,
          server: server
        )
      }
      serverConnectionStates[server.id] = .connected(version: snapshot.serverVersion)
    } catch {
      if applyTorrents {
        torrents = []
        totalDownloadSpeed = "—"
        totalUploadSpeed = "—"
        integrationNotice = error.localizedDescription
      }
      serverConnectionStates[server.id] = .failed(message: error.localizedDescription)
    }
  }

  private func torrentServer(for serverID: UUID) throws -> ServerConfiguration {
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw TorrentActionError.serverUnavailable
    }
    return server
  }

  private static func validatedServerDraft(
    name: String,
    baseURLText: String,
    username: String,
    password: String,
    helperURLText: String
  ) throws -> ServerDraft {
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedName.isEmpty else {
      throw ServerValidationError.missingName
    }

    let helperURLText = helperURLText.trimmingCharacters(in: .whitespacesAndNewlines)
    return ServerDraft(
      name: trimmedName,
      baseURL: try validatedHTTPURL(baseURLText, fieldName: "qBittorrent 地址"),
      username: username.trimmingCharacters(in: .whitespacesAndNewlines),
      password: password,
      helperURL: helperURLText.isEmpty
        ? nil
        : try validatedHTTPURL(helperURLText, fieldName: "Helper 地址")
    )
  }

  private static func validatedHTTPURL(_ text: String, fieldName: String) throws -> URL {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      let components = URLComponents(string: trimmed),
      let scheme = components.scheme?.lowercased(),
      ["http", "https"].contains(scheme),
      components.host != nil,
      let url = components.url
    else {
      throw ServerValidationError.invalidURL(fieldName)
    }
    return url
  }

  private static func validatedTorrentSource(_ text: String) throws -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw TorrentImportError.missingSource
    }

    guard let components = URLComponents(string: trimmed), let scheme = components.scheme else {
      throw TorrentImportError.invalidSource
    }

    switch scheme.lowercased() {
    case "http", "https":
      guard components.host != nil else { throw TorrentImportError.invalidSource }
    case "magnet":
      guard components.query?.isEmpty == false else { throw TorrentImportError.invalidSource }
    default:
      throw TorrentImportError.invalidSource
    }
    return trimmed
  }

  private static func validatedTorrentAddRequest(
    _ request: TorrentAddRequest
  ) throws -> TorrentAddRequest {
    let source: TorrentAddSource
    switch request.source {
    case .url(let text):
      source = .url(try validatedTorrentSource(text))
    case .file(let name, let data):
      let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !name.isEmpty, name.lowercased().hasSuffix(".torrent"), !data.isEmpty else {
        throw TorrentImportError.invalidFile
      }
      guard data.count <= 10 * 1024 * 1024 else {
        throw TorrentImportError.fileTooLarge
      }
      source = .file(name: name, data: data)
    }

    guard (request.downloadLimit ?? 0) >= 0, (request.uploadLimit ?? 0) >= 0 else {
      throw TorrentImportError.invalidSpeedLimit
    }
    return TorrentAddRequest(
      source: source,
      savePath: normalizedOptionalText(request.savePath),
      category: normalizedOptionalText(request.category),
      tags: normalizedTags(request.tags),
      downloadLimit: request.downloadLimit,
      uploadLimit: request.uploadLimit
    )
  }

  private static func validatedTorrentManagementRequest(
    _ request: TorrentManagementRequest
  ) throws -> TorrentManagementRequest {
    guard request.downloadLimit >= 0, request.uploadLimit >= 0 else {
      throw TorrentImportError.invalidSpeedLimit
    }
    return TorrentManagementRequest(
      category: normalizedOptionalText(request.category),
      tags: normalizedTags(request.tags),
      downloadLimit: request.downloadLimit,
      uploadLimit: request.uploadLimit
    )
  }

  private static func validatedTorrentIDs(_ torrentIDs: [String]) throws -> [String] {
    let normalized = Array(
      Set(
        torrentIDs
          .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
      )
    ).sorted()
    guard !normalized.isEmpty else { throw TorrentActionError.missingSelection }
    return normalized
  }

  private static func normalizedOptionalText(_ text: String?) -> String? {
    guard let text else { return nil }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  private static func normalizedTags(_ tags: [String]) -> [String] {
    var seen = Set<String>()
    return tags.compactMap { tag in
      let normalized = tag.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !normalized.isEmpty, seen.insert(normalized).inserted else { return nil }
      return normalized
    }
  }

  private func helperAuthorization(for serverID: UUID) throws -> HelperAuthorization {
    guard let server = servers.first(where: { $0.id == serverID }) else {
      throw HelperContentError.serverUnavailable
    }
    guard let baseURL = server.helperBaseURL else {
      throw HelperContentError.helperUnavailable
    }
    guard
      let token = try helperCredentialStore.token(for: serverID),
      !token.isEmpty
    else {
      throw HelperContentError.helperUnavailable
    }
    return HelperAuthorization(server: server, baseURL: baseURL, token: token)
  }

  private func handleHelperContentError(_ error: Error, serverID: UUID) {
    if error as? HelperServiceError == .unauthorized {
      try? helperCredentialStore.deleteToken(for: serverID)
      helperSubscriptionStates[serverID] = .needsRepairing
    } else {
      helperSubscriptionStates[serverID] = .failed(error.localizedDescription)
    }
  }

  private func applyLoadedHelperSubscriptions(
    serverID: UUID,
    snapshot: HelperSubscriptionSnapshot,
    status: HelperRuntimeStatus
  ) {
    helperSubscriptionStates[serverID] = .loaded(snapshot: snapshot, status: status, source: .helper)
    persistHelperCache(for: serverID, snapshot: snapshot, status: status)
  }

  private func persistHelperCache(
    for serverID: UUID,
    snapshot: HelperSubscriptionSnapshot,
    status: HelperRuntimeStatus
  ) {
    let cache = HelperSubscriptionCache(snapshot: snapshot, status: status)
    guard let data = try? JSONEncoder().encode(cache) else { return }
    defaults.set(data, forKey: Self.helperCacheStorageKeyPrefix + serverID.uuidString)
  }

  private func loadHelperCache(for serverID: UUID) -> HelperSubscriptionCache? {
    guard let data = defaults.data(forKey: Self.helperCacheStorageKeyPrefix + serverID.uuidString)
    else { return nil }
    return try? JSONDecoder().decode(HelperSubscriptionCache.self, from: data)
  }

  private func clearHelperCache(for serverID: UUID) {
    defaults.removeObject(forKey: Self.helperCacheStorageKeyPrefix + serverID.uuidString)
  }

  private func observeMikanAppLifecycleIfNeeded() {
    guard mikanBackgroundObserver == nil else { return }
    mikanBackgroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didEnterBackgroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in
        self?.isAppActiveForMikanPolling = false
        self?.evaluateMikanPollingSchedule()
      }
    }
    mikanForegroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willEnterForegroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in
        self?.isAppActiveForMikanPolling = true
        self?.evaluateMikanPollingSchedule()
      }
    }
  }

  private func evaluateMikanPollingSchedule() {
    guard isMikanSurfaceVisible, isAppActiveForMikanPolling else {
      mikanPollTimerTask?.cancel()
      mikanPollTimerTask = nil
      mikanPollInFlightTask?.cancel()
      mikanPollInFlightTask = nil
      isMikanPollInFlight = false
      return
    }
    guard mikanPollTimerTask == nil else { return }
    scheduleNextMikanPollTick()
  }

  private func scheduleNextMikanPollTick() {
    let interval = mikanPollIntervalOverride ?? Self.mikanPollingInterval(
      forEpisodeStates: trackedMikanEpisodeStates
    )
    mikanPollTimerTask = Task { [weak self] in
      try? await Task.sleep(for: interval)
      guard !Task.isCancelled else { return }
      await self?.performMikanPollTick()
    }
  }

  private func performMikanPollTick() async {
    guard isMikanSurfaceVisible, isAppActiveForMikanPolling else { return }
    scheduleNextMikanPollTick()

    guard !isMikanPollInFlight else { return }
    isMikanPollInFlight = true
    let task = Task { [weak self] in
      guard let self else { return }
      await self.refreshAllHelperSubscriptions()
    }
    mikanPollInFlightTask = task
    await task.value
    mikanPollInFlightTask = nil
    isMikanPollInFlight = false
  }

  private func teardownMikanPolling() {
    mikanPollTimerTask?.cancel()
    mikanPollTimerTask = nil
    mikanPollInFlightTask?.cancel()
    mikanPollInFlightTask = nil
    isMikanPollInFlight = false
    if let observer = mikanBackgroundObserver {
      NotificationCenter.default.removeObserver(observer)
      mikanBackgroundObserver = nil
    }
    if let observer = mikanForegroundObserver {
      NotificationCenter.default.removeObserver(observer)
      mikanForegroundObserver = nil
    }
  }

  private static func mikanRSSURL(
    baseURL: URL,
    bangumiID: String,
    subgroupID: String
  ) throws -> URL {
    guard
      var components = URLComponents(
        url: baseURL.appending(path: "RSS/Bangumi"),
        resolvingAgainstBaseURL: true
      )
    else {
      throw HelperContentError.invalidMikanURL
    }
    components.queryItems = [
      URLQueryItem(name: "bangumiId", value: bangumiID),
      URLQueryItem(name: "subgroupid", value: subgroupID),
    ]
    guard let url = components.url else { throw HelperContentError.invalidMikanURL }
    return url
  }

  private static func loadServers(from defaults: UserDefaults) -> [ServerConfiguration] {
    guard
      let data = defaults.data(forKey: serversStorageKey),
      let servers = try? JSONDecoder().decode([ServerConfiguration].self, from: data)
    else {
      return []
    }
    return servers
  }

  private static func loadActiveServerID(from defaults: UserDefaults) -> UUID? {
    defaults.string(forKey: activeServerStorageKey).flatMap(UUID.init(uuidString:))
  }

  private static func loadOrCreateHelperClientID(from defaults: UserDefaults) -> String {
    if let stored = defaults.string(forKey: helperClientIDStorageKey), !stored.isEmpty {
      return stored
    }
    let clientID = UUID().uuidString.lowercased()
    defaults.set(clientID, forKey: helperClientIDStorageKey)
    return clientID
  }

  private func persistServers() {
    guard let data = try? JSONEncoder().encode(servers) else { return }
    defaults.set(data, forKey: Self.serversStorageKey)
  }

  private func persistActiveServerID() {
    defaults.set(activeServerID?.uuidString, forKey: Self.activeServerStorageKey)
  }
}

private struct ServerDraft: Sendable {
  let name: String
  let baseURL: URL
  let username: String
  let password: String
  let helperURL: URL?
}

private struct HelperSubscriptionCache: Codable, Sendable {
  let snapshot: HelperSubscriptionSnapshot
  let status: HelperRuntimeStatus
}

enum ServerValidationError: Equatable, LocalizedError {
  case missingName
  case missingPassword
  case invalidURL(String)
  case serverUnavailable

  var errorDescription: String? {
    switch self {
    case .missingName:
      "服务器名称不能为空。"
    case .missingPassword:
      "qBittorrent 密码不能为空。"
    case .invalidURL(let fieldName):
      "\(fieldName)必须是完整的 http:// 或 https:// 地址。"
    case .serverUnavailable:
      "服务器已不存在。"
    }
  }
}

enum ServerConnectionState: Equatable, Sendable {
  case connected(version: String?)
  case connecting
  case failed(message: String)
  case idle
}

enum HelperConnectionState: Equatable, Sendable {
  case connected(HelperStatus)
  case connecting
  case failed(String)
  case idle
}

enum HelperPairingError: LocalizedError {
  case invalidCode

  var errorDescription: String? {
    "请输入 Helper 主机上显示的六位配对码。"
  }
}

struct HelperSubscriptionOutcome: Equatable, Sendable {
  let serverNames: [String]
  let mergedConflict: Bool
  let backfillFailed: Bool
}

private struct HelperAuthorization: Sendable {
  let server: ServerConfiguration
  let baseURL: URL
  let token: String
}

enum HelperContentError: LocalizedError {
  case helperUnavailable
  case invalidMikanURL
  case noEpisodes
  case noTarget
  case serverUnavailable

  var errorDescription: String? {
    switch self {
    case .helperUnavailable:
      "目标服务器尚未配对 Helper。"
    case .invalidMikanURL:
      "无法生成当前字幕组的 Mikan RSS 地址。"
    case .noEpisodes:
      "当前字幕组没有可导入的剧集。"
    case .noTarget:
      "请至少选择一个目标服务器。"
    case .serverUnavailable:
      "目标服务器已不可用。"
    }
  }
}

enum TorrentImportError: LocalizedError {
  case fileTooLarge
  case invalidFile
  case invalidSource
  case invalidSpeedLimit
  case missingSource
  case serverUnavailable

  var errorDescription: String? {
    switch self {
    case .fileTooLarge:
      "Torrent 文件不能超过 10 MB。"
    case .invalidFile:
      "请选择有效且非空的 .torrent 文件。"
    case .invalidSource:
      "请输入有效的 Magnet 或 HTTP(S) Torrent URL。"
    case .invalidSpeedLimit:
      "速度限制必须是大于或等于 0 的数值。"
    case .missingSource:
      "Torrent 来源不能为空。"
    case .serverUnavailable:
      "目标服务器已不可用，请重新选择。"
    }
  }
}

enum TorrentActionError: LocalizedError {
  case missingSelection
  case serverUnavailable
  case torrentUnavailable

  var errorDescription: String? {
    switch self {
    case .missingSelection:
      "请至少选择一个 Torrent 任务。"
    case .serverUnavailable:
      "目标服务器已不可用。"
    case .torrentUnavailable:
      "任务状态已变化，请返回列表后重试。"
    }
  }
}
