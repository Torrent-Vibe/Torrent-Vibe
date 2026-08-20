import Foundation
import XCTest

@testable import Torrent_Vibe

@MainActor
final class AppModelMikanSubscribeTests: XCTestCase {
  private func makeDetail(episodeCount: Int) -> (MikanBangumiDetail, MikanSubgroup) {
    let subgroup = MikanSubgroup(id: "583", name: "ANi")
    let episodes = (0..<episodeCount).map { index in
      MikanEpisode(
        episodeId: "ep-\(index)",
        subgroupId: subgroup.id,
        title: "Show - \(index)",
        torrentUrl: "https://mikan.example/\(index).torrent",
        sizeBytes: 123,
        publishedAt: "2026-08-01T00:00:00Z"
      )
    }
    let detail = MikanBangumiDetail(
      bangumiId: "4102",
      bangumiSubjectId: "500001",
      coverUrl: nil,
      episodes: episodes,
      subgroups: [subgroup],
      title: "Show"
    )
    return (detail, subgroup)
  }

  func testPartialOutcomeWithFailedBackfillStillReportsSuccessWithWarning() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = PerServerHelperService()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServerOnHost(
      on: model, env: env, name: "NAS", host: "192.168.1.10")
    let baseURL = try XCTUnwrap(model.servers.first { $0.id == serverID }?.helperBaseURL)
    service.setBackfillResult(.failure(HelperUnreachableError()), for: baseURL)

    let (detail, subgroup) = makeDetail(episodeCount: 2)
    let outcome = try await model.subscribeToMikan(
      detail: detail,
      subgroup: subgroup,
      baseURL: URL(string: "https://mikanani.me")!,
      serverIDs: [serverID]
    )

    XCTAssertTrue(outcome.backfillFailed, "a failed backfill must be reported as a warning")
    XCTAssertEqual(outcome.serverNames, ["NAS"], "the push itself still succeeded")

    guard case .loaded = model.helperSubscriptionState(for: serverID) else {
      return XCTFail("a failed backfill must not undo the subscription")
    }
  }

  func testSucceedingTargetStillGetsBackfilledWhenAnotherTargetsPushFails() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = PerServerHelperService()
    let model = env.makeModel(helperService: service)
    let failingServerID = try pairMikanTestServerOnHost(
      on: model, env: env, name: "Failing", host: "192.168.1.10")
    let succeedingServerID = try pairMikanTestServerOnHost(
      on: model, env: env, name: "Succeeding", host: "192.168.1.11")
    let failingBaseURL = try XCTUnwrap(
      model.servers.first { $0.id == failingServerID }?.helperBaseURL)
    let succeedingBaseURL = try XCTUnwrap(
      model.servers.first { $0.id == succeedingServerID }?.helperBaseURL)
    service.setSubscriptionsResult(.failure(HelperUnreachableError()), for: failingBaseURL)

    let (detail, subgroup) = makeDetail(episodeCount: 1)
    let outcome = try await model.subscribeToMikan(
      detail: detail,
      subgroup: subgroup,
      baseURL: URL(string: "https://mikanani.me")!,
      serverIDs: [failingServerID, succeedingServerID]
    )

    XCTAssertEqual(outcome.serverNames, ["Succeeding"])
    XCTAssertFalse(outcome.backfillFailed)
    XCTAssertEqual(
      service.backfillCallCount(for: succeedingBaseURL), 1,
      "the target whose push succeeded must still be backfilled"
    )
    XCTAssertEqual(
      service.backfillCallCount(for: failingBaseURL), 0,
      "a target whose push failed must never receive a backfill call"
    )
  }

  func testFailedPushRollsBackOnlyThatTarget() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }
    let service = PerServerHelperService()
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServerOnHost(
      on: model, env: env, name: "NAS", host: "192.168.1.10")
    let baseURL = try XCTUnwrap(model.servers.first { $0.id == serverID }?.helperBaseURL)
    service.setSubscriptionsResult(.failure(HelperUnreachableError()), for: baseURL)

    let (detail, subgroup) = makeDetail(episodeCount: 1)

    do {
      _ = try await model.subscribeToMikan(
        detail: detail,
        subgroup: subgroup,
        baseURL: URL(string: "https://mikanani.me")!,
        serverIDs: [serverID]
      )
      XCTFail("expected the fully-failed push to throw")
    } catch {}

    guard case .loaded = model.helperSubscriptionState(for: serverID) else {
      XCTAssertEqual(service.backfillCallCount(for: baseURL), 0)
      return
    }
    XCTFail("a failed push must not leave the target reporting as subscribed")
  }
}
