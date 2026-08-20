import Foundation
import XCTest

@testable import Torrent_Vibe

final class TestServerCredentialStore: ServerCredentialStore, @unchecked Sendable {
  private let lock = NSLock()
  private var passwords: [UUID: String] = [:]

  func deletePassword(for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    passwords[serverID] = nil
  }

  func setPassword(_ password: String, for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    passwords[serverID] = password
  }

  func password(for serverID: UUID) throws -> String? {
    lock.lock()
    defer { lock.unlock() }
    return passwords[serverID]
  }
}

final class TestHelperCredentialStore: HelperCredentialStore, @unchecked Sendable {
  private let lock = NSLock()
  private var tokens: [UUID: String] = [:]

  func deleteToken(for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    tokens[serverID] = nil
  }

  func setToken(_ token: String, for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    tokens[serverID] = token
  }

  func token(for serverID: UUID) throws -> String? {
    lock.lock()
    defer { lock.unlock() }
    return tokens[serverID]
  }
}

struct HelperUnreachableError: Error, LocalizedError, Equatable {
  var errorDescription: String? { "Helper 不可达。" }
}

final class ScriptedHelperService: HelperService, @unchecked Sendable {
  private let lock = NSLock()
  private var subscriptionsResult: Result<HelperSubscriptionSnapshot, Error>
  private var runtimeStatusResult: Result<HelperRuntimeStatus, Error>
  private var shouldBlockNextSubscriptionsCall = false
  private var blockContinuation: CheckedContinuation<Void, Never>?
  private(set) var subscriptionsCallCount = 0
  private(set) var runtimeStatusCallCount = 0

  init(
    subscriptionsResult: Result<HelperSubscriptionSnapshot, Error> = .success(
      HelperSubscriptionSnapshot(revision: 0, replicas: [])
    ),
    runtimeStatusResult: Result<HelperRuntimeStatus, Error> = .success(
      HelperRuntimeStatus(replicas: [], jobs: [])
    )
  ) {
    self.subscriptionsResult = subscriptionsResult
    self.runtimeStatusResult = runtimeStatusResult
  }

  func setSubscriptionsResult(_ result: Result<HelperSubscriptionSnapshot, Error>) {
    lock.lock()
    defer { lock.unlock() }
    subscriptionsResult = result
  }

  func setRuntimeStatusResult(_ result: Result<HelperRuntimeStatus, Error>) {
    lock.lock()
    defer { lock.unlock() }
    runtimeStatusResult = result
  }

  func armBlockOnNextSubscriptionsCall() {
    lock.lock()
    defer { lock.unlock() }
    shouldBlockNextSubscriptionsCall = true
  }

  func releaseBlockedCall() {
    lock.lock()
    let continuation = blockContinuation
    blockContinuation = nil
    lock.unlock()
    continuation?.resume()
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  private func recordSubscriptionsCall() -> (result: Result<HelperSubscriptionSnapshot, Error>, shouldBlock: Bool) {
    lock.lock()
    defer { lock.unlock() }
    subscriptionsCallCount += 1
    let result = subscriptionsResult
    let shouldBlock = shouldBlockNextSubscriptionsCall
    shouldBlockNextSubscriptionsCall = false
    return (result, shouldBlock)
  }

  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  {
    let (result, shouldBlock) = recordSubscriptionsCall()

    if shouldBlock {
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        lock.lock()
        blockContinuation = continuation
        lock.unlock()
      }
    }
    return try result.get()
  }

  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  private func recordRuntimeStatusCall() -> Result<HelperRuntimeStatus, Error> {
    lock.lock()
    defer { lock.unlock() }
    runtimeStatusCallCount += 1
    return runtimeStatusResult
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    try recordRuntimeStatusCall().get()
  }

  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func retry(
    at baseURL: URL,
    token: String,
    request: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func events(
    at baseURL: URL,
    token: String,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func check(at baseURL: URL, token: String) async throws {
    fatalError("not used by AppModel offline-cache/polling tests")
  }

  func unpair(at baseURL: URL, token: String) async throws {
    fatalError("not used by AppModel offline-cache/polling tests")
  }
}

final class PerServerHelperService: HelperService, @unchecked Sendable {
  private let lock = NSLock()
  private var subscriptionsResults: [String: Result<HelperSubscriptionSnapshot, Error>] = [:]
  private var replaceSubscriptionsResults: [String: Result<HelperSubscriptionSnapshot, Error>] = [:]
  private var runtimeStatusResults: [String: Result<HelperRuntimeStatus, Error>] = [:]
  private var backfillResults: [String: Result<HelperBackfillResult, Error>] = [:]
  private var backfillCallCounts: [String: Int] = [:]

  func setSubscriptionsResult(_ result: Result<HelperSubscriptionSnapshot, Error>, for baseURL: URL) {
    lock.lock()
    defer { lock.unlock() }
    subscriptionsResults[baseURL.absoluteString] = result
  }

  func setReplaceSubscriptionsResult(_ result: Result<HelperSubscriptionSnapshot, Error>, for baseURL: URL) {
    lock.lock()
    defer { lock.unlock() }
    replaceSubscriptionsResults[baseURL.absoluteString] = result
  }

  func setBackfillResult(_ result: Result<HelperBackfillResult, Error>, for baseURL: URL) {
    lock.lock()
    defer { lock.unlock() }
    backfillResults[baseURL.absoluteString] = result
  }

  func backfillCallCount(for baseURL: URL) -> Int {
    lock.lock()
    defer { lock.unlock() }
    return backfillCallCounts[baseURL.absoluteString] ?? 0
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    fatalError("not used by subscribe-action tests")
  }

  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential {
    fatalError("not used by subscribe-action tests")
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    fatalError("not used by subscribe-action tests")
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    fatalError("not used by subscribe-action tests")
  }

  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    fatalError("not used by subscribe-action tests")
  }

  private func recordSubscriptionsCall(for baseURL: URL) -> Result<HelperSubscriptionSnapshot, Error> {
    lock.lock()
    defer { lock.unlock() }
    return subscriptionsResults[baseURL.absoluteString]
      ?? .success(HelperSubscriptionSnapshot(revision: 0, replicas: []))
  }

  private func recordReplaceSubscriptionsCall(
    for baseURL: URL,
    revision: UInt64,
    replicas: [HelperReplica]
  ) -> Result<HelperSubscriptionSnapshot, Error> {
    lock.lock()
    defer { lock.unlock() }
    return replaceSubscriptionsResults[baseURL.absoluteString]
      ?? .success(HelperSubscriptionSnapshot(revision: revision + 1, replicas: replicas))
  }

  private func recordRuntimeStatusCall(for baseURL: URL) -> Result<HelperRuntimeStatus, Error> {
    lock.lock()
    defer { lock.unlock() }
    return runtimeStatusResults[baseURL.absoluteString]
      ?? .success(HelperRuntimeStatus(replicas: [], jobs: []))
  }

  private func recordBackfillCall(for baseURL: URL) -> Result<HelperBackfillResult, Error> {
    lock.lock()
    defer { lock.unlock() }
    backfillCallCounts[baseURL.absoluteString, default: 0] += 1
    return backfillResults[baseURL.absoluteString] ?? .success(HelperBackfillResult(episodes: []))
  }

  func subscriptions(at baseURL: URL, token: String) async throws -> HelperSubscriptionSnapshot {
    try recordSubscriptionsCall(for: baseURL).get()
  }

  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    try recordReplaceSubscriptionsCall(for: baseURL, revision: revision, replicas: replicas).get()
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    try recordRuntimeStatusCall(for: baseURL).get()
  }

  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    try recordBackfillCall(for: baseURL).get()
  }

  func retry(
    at baseURL: URL,
    token: String,
    request: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    fatalError("not used by subscribe-action tests")
  }

  func events(
    at baseURL: URL,
    token: String,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    fatalError("not used by subscribe-action tests")
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    fatalError("not used by subscribe-action tests")
  }

  func check(at baseURL: URL, token: String) async throws {
    fatalError("not used by subscribe-action tests")
  }

  func unpair(at baseURL: URL, token: String) async throws {
    fatalError("not used by subscribe-action tests")
  }
}

@MainActor
@discardableResult
func pairMikanTestServerOnHost(
  on model: AppModel,
  env: MikanTestEnvironment,
  name: String,
  host: String
) throws -> UUID {
  try model.addServer(
    name: name,
    baseURLText: "http://\(host):8080",
    username: "admin",
    password: "secret",
    helperURLText: "http://\(host):17890"
  )
  let id = try XCTUnwrap(model.servers.first { $0.name == name }?.id)
  try env.helperTokens.setToken("paired-token-\(name)", for: id)
  return id
}

@MainActor
@discardableResult
func waitUntil(
  timeout: Duration = .milliseconds(2000),
  poll: Duration = .milliseconds(10),
  _ condition: () -> Bool
) async -> Bool {
  let deadline = ContinuousClock.now + timeout
  while ContinuousClock.now < deadline {
    if condition() { return true }
    try? await Task.sleep(for: poll)
  }
  return condition()
}

@MainActor
struct MikanTestEnvironment {
  let suiteName: String
  let defaults: UserDefaults
  let passwords: TestServerCredentialStore
  let helperTokens: TestHelperCredentialStore

  func tearDown() {
    defaults.removePersistentDomain(forName: suiteName)
  }

  func makeModel(
    helperService: any HelperService,
    mikanPollIntervalOverride: Duration? = nil
  ) -> AppModel {
    AppModel(
      launchArguments: ["tests"],
      defaults: defaults,
      credentialStore: passwords,
      helperCredentialStore: helperTokens,
      helperService: helperService,
      torrentRepository: DemoTorrentRepository(),
      mikanPollIntervalOverride: mikanPollIntervalOverride
    )
  }
}

@MainActor
func makeMikanTestEnvironment(name: String = #function) throws -> MikanTestEnvironment {
  let suiteName = "AppModelMikanTests.\(name).\(UUID().uuidString)"
  let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
  defaults.removePersistentDomain(forName: suiteName)
  return MikanTestEnvironment(
    suiteName: suiteName,
    defaults: defaults,
    passwords: TestServerCredentialStore(),
    helperTokens: TestHelperCredentialStore()
  )
}

@discardableResult
@MainActor
func pairMikanTestServer(
  on model: AppModel,
  env: MikanTestEnvironment,
  name: String = "NAS"
) throws -> UUID {
  try model.addServer(
    name: name,
    baseURLText: "http://192.168.1.10:8080",
    username: "admin",
    password: "secret",
    helperURLText: "http://192.168.1.10:17890"
  )
  let id = try XCTUnwrap(model.servers.first { $0.name == name }?.id)
  try env.helperTokens.setToken("paired-token", for: id)
  return id
}
