import Foundation
import UIKit
import XCTest

@testable import Torrent_Vibe

@MainActor
final class AppModelMikanPollingTests: XCTestCase {
  private static let testPollInterval: Duration = .milliseconds(25)
  private static let stableWindow: Duration = .milliseconds(250)

  func testMikanPollingIntervalIsActiveWhenAnyTrackedEpisodeIsPendingAddedDownloadingOrRenaming() {
    let activeStates: [HelperEpisodeState] = [.pending, .added, .downloading, .renaming]
    for state in activeStates {
      XCTAssertEqual(
        AppModel.mikanPollingInterval(forEpisodeStates: [state]), .seconds(5),
        "\(state) must poll at the active cadence"
      )
    }
    XCTAssertEqual(
      AppModel.mikanPollingInterval(forEpisodeStates: [.done, .downloading]), .seconds(5),
      "a single active episode among otherwise-settled ones still forces the active cadence"
    )
  }

  func testMikanPollingIntervalIsSettledWhenAllTrackedEpisodesAreSettledOrEmpty() {
    let settledStates: [HelperEpisodeState] = [.done, .skipped, .failed, .needsManual]
    XCTAssertEqual(AppModel.mikanPollingInterval(forEpisodeStates: settledStates), .seconds(30))
    XCTAssertEqual(AppModel.mikanPollingInterval(forEpisodeStates: []), .seconds(30))
  }

  func testEnteringBackgroundStopsMikanPollingTicks() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService()
    let model = env.makeModel(
      helperService: service, mikanPollIntervalOverride: Self.testPollInterval)
    _ = try pairMikanTestServer(on: model, env: env)

    model.startMikanPolling()
    defer { model.stopMikanPolling() }

    let ticked = await waitUntil { service.subscriptionsCallCount > 0 }
    XCTAssertTrue(ticked, "polling should have ticked at least once")

    NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
    try await Task.sleep(for: .milliseconds(20))
    let countAtBackground = service.subscriptionsCallCount

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.subscriptionsCallCount, countAtBackground,
      "no further ticks should fire while the app is backgrounded"
    )
  }

  func testMikanPollingDropsOverlappingTickInsteadOfQueueing() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService()
    let model = env.makeModel(
      helperService: service, mikanPollIntervalOverride: Self.testPollInterval)
    _ = try pairMikanTestServer(on: model, env: env)

    service.armBlockOnNextSubscriptionsCall()
    model.startMikanPolling()
    defer { model.stopMikanPolling() }

    let blocked = await waitUntil { service.subscriptionsCallCount == 1 }
    XCTAssertTrue(blocked, "the first tick should be in flight and blocked")

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.subscriptionsCallCount, 1,
      "a tick arriving while one is in flight must be dropped, not queued"
    )

    service.releaseBlockedCall()
    let resumed = await waitUntil { service.subscriptionsCallCount >= 2 }
    XCTAssertTrue(resumed, "polling should resume once the in-flight refresh completes")
  }

  func testStopMikanPollingCancelsTimerAndIgnoresLaterLifecycleNotifications() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService()
    let model = env.makeModel(
      helperService: service, mikanPollIntervalOverride: Self.testPollInterval)
    _ = try pairMikanTestServer(on: model, env: env)

    model.startMikanPolling()
    let ticked = await waitUntil { service.subscriptionsCallCount > 0 }
    XCTAssertTrue(ticked)
    XCTAssertTrue(
      model.isObservingMikanAppLifecycle,
      "starting polling should register the background/foreground observers"
    )

    model.stopMikanPolling()
    XCTAssertFalse(
      model.isObservingMikanAppLifecycle,
      "stopping polling must remove the lifecycle observers, not just cancel the timer"
    )
    let countAfterStop = service.subscriptionsCallCount

    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.subscriptionsCallCount, countAfterStop,
      "no stray timer should keep ticking after stop"
    )

    NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
    NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
    try await Task.sleep(for: Self.stableWindow)
    XCTAssertEqual(
      service.subscriptionsCallCount, countAfterStop,
      "stop must be a full teardown: no observer should remain attached to resume polling"
    )
  }
}
