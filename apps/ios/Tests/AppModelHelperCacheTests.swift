import Foundation
import XCTest

@testable import Torrent_Vibe

@MainActor
final class AppModelHelperCacheTests: XCTestCase {
  func testOfflineFallbackServesCachedSubscriptionGroupsWhenHelperBecomesUnreachable() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }

    let replica = HelperReplica(
      id: "mikan:1:2",
      bangumiId: "1",
      title: "Test Bangumi",
      bangumiSubjectId: nil,
      subgroupId: "2",
      subgroupName: "Test Subgroup",
      rssUrl: "https://mikan.example/rss"
    )
    let replicaStatus = HelperReplicaStatus(
      id: replica.id,
      bangumiId: replica.bangumiId,
      title: replica.title,
      bangumiSubjectId: replica.bangumiSubjectId,
      subgroupId: replica.subgroupId,
      subgroupName: replica.subgroupName,
      rssUrl: replica.rssUrl,
      episodes: []
    )
    let service = ScriptedHelperService(
      subscriptionsResult: .success(HelperSubscriptionSnapshot(revision: 1, replicas: [replica])),
      runtimeStatusResult: .success(HelperRuntimeStatus(replicas: [replicaStatus], jobs: []))
    )
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    await model.refreshHelperSubscriptions(for: serverID)
    XCTAssertEqual(model.helperSubscriptionGroups.count, 1)
    guard case .loaded(_, _, let liveSource) = model.helperSubscriptionState(for: serverID) else {
      return XCTFail("expected a loaded state after a successful refresh")
    }
    XCTAssertEqual(liveSource, .helper)

    service.setSubscriptionsResult(.failure(HelperUnreachableError()))
    service.setRuntimeStatusResult(.failure(HelperUnreachableError()))

    await model.refreshHelperSubscriptions(for: serverID)

    XCTAssertEqual(
      model.helperSubscriptionGroups.count, 1,
      "an unreachable Helper must not blank out a previously-known subscription list"
    )
    XCTAssertEqual(model.helperSubscriptionGroups.first?.replica.title, "Test Bangumi")
    guard case .loaded(_, _, let cachedSource) = model.helperSubscriptionState(for: serverID) else {
      return XCTFail("expected the cached snapshot to still report as loaded")
    }
    XCTAssertEqual(cachedSource, .cache, "the fallback must be marked as cached, not silently shown as live")
  }

  func testUnauthorizedHelperProducesNeedsRepairingNotCachedOffline() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }

    let replica = HelperReplica(
      id: "mikan:1:2",
      bangumiId: "1",
      title: "Test Bangumi",
      bangumiSubjectId: nil,
      subgroupId: "2",
      subgroupName: "Test Subgroup",
      rssUrl: "https://mikan.example/rss"
    )
    let replicaStatus = HelperReplicaStatus(
      id: replica.id,
      bangumiId: replica.bangumiId,
      title: replica.title,
      bangumiSubjectId: replica.bangumiSubjectId,
      subgroupId: replica.subgroupId,
      subgroupName: replica.subgroupName,
      rssUrl: replica.rssUrl,
      episodes: []
    )
    let service = ScriptedHelperService(
      subscriptionsResult: .success(HelperSubscriptionSnapshot(revision: 1, replicas: [replica])),
      runtimeStatusResult: .success(HelperRuntimeStatus(replicas: [replicaStatus], jobs: []))
    )
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    await model.refreshHelperSubscriptions(for: serverID)
    guard case .loaded = model.helperSubscriptionState(for: serverID) else {
      return XCTFail("expected a loaded state to seed a cache before the auth failure")
    }
    XCTAssertTrue(model.hasStoredHelperToken(for: serverID))

    service.setSubscriptionsResult(.failure(HelperServiceError.unauthorized))
    service.setRuntimeStatusResult(.failure(HelperServiceError.unauthorized))

    await model.refreshHelperSubscriptions(for: serverID)

    XCTAssertEqual(
      model.helperSubscriptionState(for: serverID), .needsRepairing,
      "a revoked or expired token must surface as a distinct auth failure, not stale cached data"
    )
    XCTAssertFalse(
      model.hasStoredHelperToken(for: serverID),
      "an auth failure must clear the now-invalid token so the server drops out of pairedHelperServers"
    )
    XCTAssertTrue(
      model.helperSubscriptionVisibleServers.contains { $0.id == serverID },
      "a needsRepairing server must stay visible in the accessor the Discover UI renders from, not vanish"
    )

    await model.refreshAllHelperSubscriptions()

    XCTAssertEqual(
      model.helperSubscriptionState(for: serverID), .needsRepairing,
      "a later refresh cycle (pull-to-refresh, polling) must not prune the needsRepairing state before the user re-pairs"
    )
    XCTAssertTrue(
      model.helperSubscriptionVisibleServers.contains { $0.id == serverID },
      "the server must still be visible after a subsequent refresh cycle, not just the first one"
    )
  }

  func testUnauthorizedMutationSurfacesNeedsRepairingNotGenericFailure() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }

    let service = ScriptedHelperService(
      subscriptionsResult: .failure(HelperServiceError.unauthorized)
    )
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    do {
      try await model.unsubscribeFromHelper(serverID: serverID, replicaID: "mikan:1:2")
      XCTFail("expected the unauthorized error to propagate to the caller")
    } catch {}

    XCTAssertEqual(
      model.helperSubscriptionState(for: serverID), .needsRepairing,
      "a 401 discovered by a mutation must surface the same needsRepairing remedy as the read path"
    )
    XCTAssertFalse(model.hasStoredHelperToken(for: serverID))
  }

  func testHelperCacheRoundTripPreservesNeverCheckedOptionalsAndCheckedZeroDistinctly() async throws {
    let env = try makeMikanTestEnvironment()
    defer { env.tearDown() }

    let neverChecked = HelperReplica(
      id: "mikan:1:2",
      bangumiId: "1",
      title: "Never Checked",
      bangumiSubjectId: nil,
      subgroupId: "2",
      subgroupName: "Subgroup A",
      rssUrl: "https://mikan.example/rss-a"
    )
    let neverCheckedStatus = HelperReplicaStatus(
      id: neverChecked.id,
      bangumiId: neverChecked.bangumiId,
      title: neverChecked.title,
      bangumiSubjectId: neverChecked.bangumiSubjectId,
      subgroupId: neverChecked.subgroupId,
      subgroupName: neverChecked.subgroupName,
      rssUrl: neverChecked.rssUrl,
      episodes: [],
      checkedAt: nil,
      checkError: nil,
      consecutiveFailures: nil
    )
    let healthy = HelperReplica(
      id: "mikan:3:4",
      bangumiId: "3",
      title: "Checked Healthy",
      bangumiSubjectId: nil,
      subgroupId: "4",
      subgroupName: "Subgroup B",
      rssUrl: "https://mikan.example/rss-b"
    )
    let healthyStatus = HelperReplicaStatus(
      id: healthy.id,
      bangumiId: healthy.bangumiId,
      title: healthy.title,
      bangumiSubjectId: healthy.bangumiSubjectId,
      subgroupId: healthy.subgroupId,
      subgroupName: healthy.subgroupName,
      rssUrl: healthy.rssUrl,
      episodes: [],
      checkedAt: Date(timeIntervalSince1970: 1_700_000_000),
      checkError: nil,
      consecutiveFailures: 0
    )
    let service = ScriptedHelperService(
      subscriptionsResult: .success(
        HelperSubscriptionSnapshot(revision: 1, replicas: [neverChecked, healthy])
      ),
      runtimeStatusResult: .success(
        HelperRuntimeStatus(replicas: [neverCheckedStatus, healthyStatus], jobs: [])
      )
    )
    let model = env.makeModel(helperService: service)
    let serverID = try pairMikanTestServer(on: model, env: env)

    await model.refreshHelperSubscriptions(for: serverID)

    service.setSubscriptionsResult(.failure(HelperUnreachableError()))
    service.setRuntimeStatusResult(.failure(HelperUnreachableError()))
    await model.refreshHelperSubscriptions(for: serverID)

    guard case .loaded(_, let status, let source) = model.helperSubscriptionState(for: serverID)
    else {
      return XCTFail("expected the cached snapshot to still report as loaded")
    }
    XCTAssertEqual(source, .cache)

    let roundTrippedNeverChecked = try XCTUnwrap(
      status.replicas.first { $0.id == neverChecked.id }
    )
    XCTAssertNil(roundTrippedNeverChecked.checkedAt)
    XCTAssertNil(roundTrippedNeverChecked.checkError)
    XCTAssertNil(
      roundTrippedNeverChecked.consecutiveFailures,
      "never-checked must round-trip through the cache as nil, not 0"
    )

    let roundTrippedHealthy = try XCTUnwrap(status.replicas.first { $0.id == healthy.id })
    XCTAssertNotNil(roundTrippedHealthy.checkedAt)
    XCTAssertEqual(
      roundTrippedHealthy.consecutiveFailures, 0,
      "checked-and-healthy must round-trip through the cache as 0, not nil"
    )
  }
}
