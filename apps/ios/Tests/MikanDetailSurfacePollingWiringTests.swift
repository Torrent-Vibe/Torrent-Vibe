import Foundation
import UIKit
import XCTest

@testable import Torrent_Vibe

@MainActor
final class MikanDetailSurfacePollingWiringTests: XCTestCase {
  private static let testPollInterval: Duration = .milliseconds(25)

  func testSubscriptionsScreenStartsAndStopsMikanPollingOnAppearAndDisappear() throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let model = env.makeModel(
      helperService: ScriptedHelperService(), mikanPollIntervalOverride: Self.testPollInterval)

    let controller = SubscriptionsViewController(
      model: model,
      baseURL: URL(string: "https://mikanani.me"),
      onOpenSubscription: { _ in }
    )
    _ = controller.view

    XCTAssertFalse(model.isObservingMikanAppLifecycle)
    controller.viewWillAppear(true)
    XCTAssertTrue(
      model.isObservingMikanAppLifecycle,
      "the subscriptions screen must start Mikan polling while visible"
    )

    controller.viewWillDisappear(true)
    XCTAssertFalse(
      model.isObservingMikanAppLifecycle,
      "the subscriptions screen must stop Mikan polling once it leaves the screen"
    )
  }

  func testMikanDetailScreenStartsAndStopsMikanPollingOnAppearAndDisappear() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let model = env.makeModel(
      helperService: ScriptedHelperService(), mikanPollIntervalOverride: Self.testPollInterval)
    let runtime = try MikanJavaScriptRuntime()
    let card = MikanBangumiCard(bangumiId: "4102", coverUrl: nil, title: "Show", weekday: nil)

    let controller = MikanDetailViewController(
      card: card,
      baseURL: URL(string: "https://mikanani.me")!,
      runtime: runtime,
      contentService: nil,
      isDemoMode: true,
      model: model,
      initialSubgroupID: nil
    )
    _ = controller.view

    XCTAssertFalse(model.isObservingMikanAppLifecycle)
    controller.viewWillAppear(true)
    XCTAssertTrue(
      model.isObservingMikanAppLifecycle,
      "the Mikan detail screen must start Mikan polling while visible"
    )

    controller.viewWillDisappear(true)
    XCTAssertFalse(
      model.isObservingMikanAppLifecycle,
      "the Mikan detail screen must stop Mikan polling once it leaves the screen"
    )
  }
}
