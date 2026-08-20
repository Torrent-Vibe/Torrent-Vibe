import Foundation
import XCTest

@testable import Torrent_Vibe

@MainActor
final class HelperLogStateTests: XCTestCase {
  private static let testPollInterval: Duration = .milliseconds(25)
  private static let stableWindow: Duration = .milliseconds(250)

  func testEventsPollingTicksImmediatelyAndAgainAfterTheInterval() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    let ticked = await waitUntil { service.eventsCallCount >= 2 }
    XCTAssertTrue(ticked, "polling should tick immediately and again after the interval")
    state.stopVisible()
  }

  func testStopVisibleCancelsPollingAndNoFurtherEventsCallsHappen() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    let ticked = await waitUntil { service.eventsCallCount > 0 }
    XCTAssertTrue(ticked)

    state.stopVisible()
    XCTAssertFalse(state.isPollingEvents, "stop must leave no pending polling task")
    let countAtStop = service.eventsCallCount

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.eventsCallCount, countAtStop,
      "no further events calls should happen once the screen is no longer visible")
  }

  func testNoEventsRequestFiredWhenEventsCapabilityIsAbsent() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["logs"])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    XCTAssertEqual(state.tab, .raw, "should default to the tab whose capability is supported")
    _ = await waitUntil { service.logsCallCount > 0 }

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.eventsCallCount, 0,
      "the events endpoint must never be called when the events capability is absent")
    state.stopVisible()
  }

  func testNoEventsRequestFiredWhenNeitherCapabilityIsSupported() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: [])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    XCTAssertEqual(
      state.tab, .events, "defaults to events so the too-old notice has a tab to land on")
    XCTAssertEqual(state.tabState(.events), .unavailable)
    XCTAssertFalse(
      state.isPollingEvents, "must not start polling for a tab whose capability is absent")

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.eventsCallCount, 0,
      "the events endpoint must never be called when neither capability is supported")
    XCTAssertEqual(service.logsCallCount, 0)
    state.stopVisible()
  }

  func testNoLogsRequestFiredWhenLogsCapabilityIsAbsentAndRawTabIsSelected() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events"])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    state.selectTab(.raw)
    try await Task.sleep(for: Self.stableWindow)

    XCTAssertEqual(
      service.logsCallCount, 0,
      "the logs endpoint must never be called when the logs capability is absent")
    state.stopVisible()
  }

  func testSwitchingAwayFromEventsTabStopsEventsPolling() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    let ticked = await waitUntil { service.eventsCallCount > 0 }
    XCTAssertTrue(ticked)

    state.selectTab(.raw)
    XCTAssertFalse(state.isPollingEvents, "switching to the raw tab must stop events polling")
    let countAtSwitch = service.eventsCallCount

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(service.eventsCallCount, countAtSwitch)
    state.stopVisible()
  }
}

private final class ScriptedLogHelperService: HelperService, @unchecked Sendable {
  private let lock = NSLock()
  private let capabilities: [String]
  private(set) var eventsCallCount = 0
  private(set) var logsCallCount = 0

  init(capabilities: [String]) {
    self.capabilities = capabilities
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    HelperDiscoveryInfo(
      version: "2.0.0", capabilities: capabilities, clientCount: 1, requiresPairingCode: true)
  }

  func pair(
    at baseURL: URL, code: String, clientID: String, clientName: String
  ) async throws -> HelperPairingCredential {
    fatalError("not used by HelperLogStateTests")
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    fatalError("not used by HelperLogStateTests")
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    fatalError("not used by HelperLogStateTests")
  }

  func updateProfile(
    at baseURL: URL, token: String, revision: UInt64, mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    fatalError("not used by HelperLogStateTests")
  }

  func subscriptions(at baseURL: URL, token: String) async throws -> HelperSubscriptionSnapshot {
    fatalError("not used by HelperLogStateTests")
  }

  func replaceSubscriptions(
    at baseURL: URL, token: String, revision: UInt64, replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    fatalError("not used by HelperLogStateTests")
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    fatalError("not used by HelperLogStateTests")
  }

  func backfill(
    at baseURL: URL, token: String, bangumiID: String, subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    fatalError("not used by HelperLogStateTests")
  }

  func retry(
    at baseURL: URL, token: String, request: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    fatalError("not used by HelperLogStateTests")
  }

  func events(
    at baseURL: URL, token: String, since: UInt64?, level: String?, replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    HelperEventsPage(events: [], cursor: UInt64(recordEventsCall()))
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    recordLogsCall()
    return "log line"
  }

  private func recordEventsCall() -> Int {
    lock.lock()
    defer { lock.unlock() }
    eventsCallCount += 1
    return eventsCallCount
  }

  private func recordLogsCall() {
    lock.lock()
    defer { lock.unlock() }
    logsCallCount += 1
  }

  func check(at baseURL: URL, token: String) async throws {
    fatalError("not used by HelperLogStateTests")
  }

  func unpair(at baseURL: URL, token: String) async throws {
    fatalError("not used by HelperLogStateTests")
  }
}
