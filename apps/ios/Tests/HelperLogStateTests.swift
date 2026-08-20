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

  func testEventsErrorMessageIsSetOnFailureAndClearedByTheNextSuccessfulPoll() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    service.failNextEventsCall()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    let failed = await waitUntil { state.eventsErrorMessage != nil }
    XCTAssertTrue(failed, "a failed fetch must surface an error message")
    XCTAssertTrue(
      state.filteredEvents.isEmpty, "no data arrived from the failed fetch")

    let recovered = await waitUntil {
      state.eventsErrorMessage == nil && service.eventsCallCount >= 2
    }
    XCTAssertTrue(recovered, "a later successful poll must clear a previously set error")
    state.stopVisible()
  }

  func testEventsHasNoErrorMessageWhenThereAreGenuinelyNoEventsAndNoFailure() async throws {
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

    XCTAssertNil(
      state.eventsErrorMessage, "a successful poll with no events must not report an error")
    XCTAssertTrue(state.filteredEvents.isEmpty)
    state.stopVisible()
  }

  func testRawErrorMessageIsSetOnFailureAndClearedByANextSuccessfulLoad() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    service.failNextLogsCall()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    state.selectTab(.raw)
    let failed = await waitUntil { state.rawErrorMessage != nil }
    XCTAssertTrue(failed, "a failed raw-log fetch must surface an error message")
    XCTAssertTrue(state.rawText.isEmpty, "no data arrived from the failed fetch")

    state.selectTab(.events)
    state.selectTab(.raw)
    let recovered = await waitUntil {
      state.rawErrorMessage == nil && !state.rawText.isEmpty
    }
    XCTAssertTrue(recovered, "a later successful load must clear a previously set error")
    state.stopVisible()
  }

  func testDiscoveryFailureRendersTheErrorAndNotTheTooOldMessage() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    service.failNextDiscoverCall()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    XCTAssertTrue(
      state.discoveryFailed,
      "a discovery failure must be distinguishable from a genuine capability absence")
    XCTAssertNotNil(state.discoveryErrorMessage)
    XCTAssertNil(state.discovery, "a failed discovery must not fabricate a capability set")
    state.stopVisible()
  }

  func testGenuineCapabilityAbsenceStillReportsTooOldNotDiscoveryFailure() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: [])
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    XCTAssertFalse(
      state.discoveryFailed, "a successful discovery must never report a discovery failure")
    XCTAssertNil(state.discoveryErrorMessage)
    XCTAssertEqual(
      state.tabState(.events), .unavailable,
      "a Helper that genuinely lacks the capability still shows as unavailable")
    state.stopVisible()
  }

  func testSuccessfulDiscoveryAfterAFailureClearsTheDiscoveryError() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedLogHelperService(capabilities: ["events", "logs"])
    service.failNextDiscoverCall()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    let state = HelperLogState(
      model: model, serverID: serverID, pollIntervalOverride: Self.testPollInterval)
    state.startVisible()
    await state.loadDiscoveryIfNeeded()

    XCTAssertTrue(state.discoveryFailed)

    await state.loadDiscoveryIfNeeded()

    XCTAssertFalse(
      state.discoveryFailed, "a later successful discovery must clear the failure state")
    XCTAssertNil(state.discoveryErrorMessage)
    XCTAssertNotNil(state.discovery)
    state.stopVisible()
  }
}

private struct ScriptedLogHelperServiceError: Error, LocalizedError {
  var errorDescription: String? { "Helper 请求失败（HTTP 500）。" }
}

private final class ScriptedLogHelperService: HelperService, @unchecked Sendable {
  private let lock = NSLock()
  private let capabilities: [String]
  private(set) var eventsCallCount = 0
  private(set) var logsCallCount = 0
  private(set) var discoverCallCount = 0
  private var eventsFailuresRemaining = 0
  private var logsFailuresRemaining = 0
  private var discoverFailuresRemaining = 0

  init(capabilities: [String]) {
    self.capabilities = capabilities
  }

  func failNextEventsCall() {
    lock.lock()
    eventsFailuresRemaining += 1
    lock.unlock()
  }

  func failNextLogsCall() {
    lock.lock()
    logsFailuresRemaining += 1
    lock.unlock()
  }

  func failNextDiscoverCall() {
    lock.lock()
    discoverFailuresRemaining += 1
    lock.unlock()
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    if recordDiscoverCall() {
      throw ScriptedLogHelperServiceError()
    }
    return HelperDiscoveryInfo(
      version: "2.0.0", capabilities: capabilities, clientCount: 1, requiresPairingCode: true)
  }

  private func recordDiscoverCall() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    discoverCallCount += 1
    guard discoverFailuresRemaining > 0 else { return false }
    discoverFailuresRemaining -= 1
    return true
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
    let (count, shouldFail) = recordEventsCall()
    if shouldFail {
      throw ScriptedLogHelperServiceError()
    }
    return HelperEventsPage(events: [], cursor: UInt64(count))
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    if recordLogsCall() {
      throw ScriptedLogHelperServiceError()
    }
    return "log line"
  }

  private func recordEventsCall() -> (count: Int, shouldFail: Bool) {
    lock.lock()
    defer { lock.unlock() }
    eventsCallCount += 1
    var shouldFail = false
    if eventsFailuresRemaining > 0 {
      eventsFailuresRemaining -= 1
      shouldFail = true
    }
    return (eventsCallCount, shouldFail)
  }

  private func recordLogsCall() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    logsCallCount += 1
    guard logsFailuresRemaining > 0 else { return false }
    logsFailuresRemaining -= 1
    return true
  }

  func check(at baseURL: URL, token: String) async throws {
    fatalError("not used by HelperLogStateTests")
  }

  func unpair(at baseURL: URL, token: String) async throws {
    fatalError("not used by HelperLogStateTests")
  }
}
