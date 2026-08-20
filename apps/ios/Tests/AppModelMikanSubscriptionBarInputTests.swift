import Foundation
import XCTest

@testable import Torrent_Vibe

@MainActor
final class AppModelMikanSubscriptionBarInputTests: XCTestCase {
  private func snapshot() -> HelperSubscriptionSnapshot {
    HelperSubscriptionSnapshot(
      revision: 1,
      replicas: [
        HelperReplica(
          id: "mikan:4102:583",
          bangumiId: "4102",
          title: "Show",
          bangumiSubjectId: nil,
          subgroupId: "583",
          subgroupName: "ANi",
          rssUrl: "https://mikanani.me/RSS/4102/583"
        )
      ]
    )
  }

  func testBarInputIsNilWhenNoServerKnowsThisSubscription() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService(subscriptionsResult: .success(snapshot()))
    let model = env.makeModel(helperService: service)
    _ = try pairMikanTestServer(on: model, env: env)

    XCTAssertNil(model.mikanSubscriptionBarInput(bangumiID: "9999", subgroupID: "1"))
  }

  func testBarInputSurvivesTokenLossAsNeedsRepairingUsingLastKnownCache() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService(subscriptionsResult: .success(snapshot()))
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env, name: "NAS")

    await model.refreshHelperSubscriptions(for: serverID)
    guard case .loaded = model.helperSubscriptionState(for: serverID) else {
      return XCTFail("precondition: server must load successfully before losing its token")
    }
    XCTAssertNotNil(model.mikanSubscriptionBarInput(bangumiID: "4102", subgroupID: "583"))

    service.setSubscriptionsResult(.failure(HelperServiceError.unauthorized))
    await model.refreshHelperSubscriptions(for: serverID)
    XCTAssertEqual(model.helperSubscriptionState(for: serverID), .needsRepairing)

    let input = try XCTUnwrap(
      model.mikanSubscriptionBarInput(bangumiID: "4102", subgroupID: "583"),
      "a subscription that was known before the token was revoked must still surface a bar input"
    )
    XCTAssertEqual(input.targets.count, 1)
    XCTAssertTrue(input.targets[0].needsRepairing)

    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(variant, .needsRepairing(serverLabel: "NAS"))
  }

  func testBarInputIsNilForAnUnrelatedSubscriptionOnANeedsRepairingServer() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = ScriptedHelperService(subscriptionsResult: .success(snapshot()))
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env, name: "NAS")

    await model.refreshHelperSubscriptions(for: serverID)
    service.setSubscriptionsResult(.failure(HelperServiceError.unauthorized))
    await model.refreshHelperSubscriptions(for: serverID)
    XCTAssertEqual(model.helperSubscriptionState(for: serverID), .needsRepairing)

    XCTAssertNil(model.mikanSubscriptionBarInput(bangumiID: "0000", subgroupID: "1"))
  }
}
