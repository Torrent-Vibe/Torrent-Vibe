import Foundation
import XCTest

@testable import Torrent_Vibe

final class MikanSubscriptionBarModelTests: XCTestCase {
  private func target(
    serverName: String = "NAS",
    source: HelperSubscriptionSource = .helper,
    checkedAt: Date? = nil,
    checkError: String? = nil,
    consecutiveFailures: Int? = nil,
    needsRepairing: Bool = false
  ) -> MikanSubscriptionBarTarget {
    MikanSubscriptionBarTarget(
      serverName: serverName,
      source: source,
      checkedAt: checkedAt,
      checkError: checkError,
      consecutiveFailures: consecutiveFailures,
      needsRepairing: needsRepairing
    )
  }

  func testHealthyVariantWithCheckedAt() {
    let checkedAt = Date(timeIntervalSince1970: 1000)
    let input = MikanSubscriptionBarInput(
      targets: [target(checkedAt: checkedAt, consecutiveFailures: 0)],
      progress: MikanSubscriptionBarProgress(ready: 8, total: 12, failed: 1)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(
      variant,
      .healthy(
        serverLabel: "NAS", ready: 8, total: 12, failed: 1,
        checkedAt: .checked(checkedAt)
      )
    )
  }

  func testNeverCheckedIsDistinctFromHealthyWithCheckedAt() {
    let input = MikanSubscriptionBarInput(
      targets: [target(checkedAt: nil, consecutiveFailures: nil)],
      progress: MikanSubscriptionBarProgress(ready: 0, total: 3, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    guard case .healthy(_, _, _, _, let checkedAt) = variant else {
      return XCTFail("expected healthy variant, got \(variant)")
    }
    XCTAssertEqual(checkedAt, .never)
    XCTAssertNotEqual(
      variant,
      .healthy(
        serverLabel: "NAS", ready: 0, total: 3, failed: 0,
        checkedAt: .checked(Date(timeIntervalSince1970: 0))
      )
    )
  }

  func testCheckFailingVariantPicksWorstFailingTarget() {
    let input = MikanSubscriptionBarInput(
      targets: [
        target(serverName: "Mac", checkError: "timeout", consecutiveFailures: 2),
        target(serverName: "NAS", checkError: "connection refused", consecutiveFailures: 4),
      ],
      progress: MikanSubscriptionBarProgress(ready: 0, total: 0, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(
      variant,
      .checkFailing(
        serverLabel: "Mac、NAS", checkError: "connection refused", consecutiveFailures: 4
      )
    )
  }

  func testOfflineVariantWhenAllTargetsAreCacheSourced() {
    let checkedAt = Date(timeIntervalSince1970: 2000)
    let input = MikanSubscriptionBarInput(
      targets: [target(source: .cache, checkedAt: checkedAt)],
      progress: MikanSubscriptionBarProgress(ready: 1, total: 2, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(variant, .offline(serverLabel: "NAS", checkedAt: checkedAt))
  }

  func testMixedCacheAndHelperSourcesIsNotOffline() {
    let input = MikanSubscriptionBarInput(
      targets: [
        target(serverName: "Mac", source: .cache),
        target(serverName: "NAS", source: .helper, consecutiveFailures: 0),
      ],
      progress: MikanSubscriptionBarProgress(ready: 1, total: 1, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    guard case .healthy = variant else {
      return XCTFail("expected healthy variant when at least one target is live, got \(variant)")
    }
  }

  func testNeedsRepairingVariantTakesPriorityOverHealthyTargets() {
    let input = MikanSubscriptionBarInput(
      targets: [
        target(serverName: "NAS", consecutiveFailures: 0),
        target(serverName: "Mac", needsRepairing: true),
      ],
      progress: MikanSubscriptionBarProgress(ready: 1, total: 1, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(variant, .needsRepairing(serverLabel: "NAS、Mac"))
  }

  func testNeedsRepairingVariantTakesPriorityOverOffline() {
    let input = MikanSubscriptionBarInput(
      targets: [
        target(serverName: "Mac", source: .cache),
        target(serverName: "NAS", needsRepairing: true),
      ],
      progress: MikanSubscriptionBarProgress(ready: 0, total: 0, failed: 0)
    )
    let variant = MikanSubscriptionBarModel.build(input)
    XCTAssertEqual(variant, .needsRepairing(serverLabel: "Mac、NAS"))
  }

  func testProgressResolvesWorstStateAcrossTargetsForDuplicateEpisodes() {
    let targets = [
      HelperSubscriptionTarget(
        serverID: UUID(), serverName: "NAS", replicaID: "r",
        episodes: [
          HelperEpisodeStatus(
            episodeId: "e1", title: "E1", season: nil, episode: 1, state: .done, infohash: nil,
            lastError: nil),
          HelperEpisodeStatus(
            episodeId: "e2", title: "E2", season: nil, episode: 2, state: .downloading,
            infohash: nil, lastError: nil),
        ]
      ),
      HelperSubscriptionTarget(
        serverID: UUID(), serverName: "Mac", replicaID: "r",
        episodes: [
          HelperEpisodeStatus(
            episodeId: "e1", title: "E1", season: nil, episode: 1, state: .failed, infohash: nil,
            lastError: nil),
          HelperEpisodeStatus(
            episodeId: "e3", title: "E3", season: nil, episode: 3, state: .needsManual,
            infohash: nil, lastError: nil),
        ]
      ),
    ]
    let progress = MikanSubscriptionBarModel.progress(from: targets)
    XCTAssertEqual(progress, MikanSubscriptionBarProgress(ready: 0, total: 3, failed: 2))
  }

  func testProgressCountsReadyAndFailedIndependently() {
    let targets = [
      HelperSubscriptionTarget(
        serverID: UUID(), serverName: "NAS", replicaID: "r",
        episodes: [
          HelperEpisodeStatus(
            episodeId: "e1", title: "E1", season: nil, episode: 1, state: .done, infohash: nil,
            lastError: nil),
          HelperEpisodeStatus(
            episodeId: "e2", title: "E2", season: nil, episode: 2, state: .done, infohash: nil,
            lastError: nil),
          HelperEpisodeStatus(
            episodeId: "e3", title: "E3", season: nil, episode: 3, state: .pending, infohash: nil,
            lastError: nil),
        ]
      )
    ]
    let progress = MikanSubscriptionBarModel.progress(from: targets)
    XCTAssertEqual(progress, MikanSubscriptionBarProgress(ready: 2, total: 3, failed: 0))
  }

  func testSegmentsForHealthyVariantMatchExpectedCopy() {
    let checkedAt = Date(timeIntervalSince1970: 0)
    let now = checkedAt.addingTimeInterval(125)
    let variant = MikanSubscriptionBarVariant.healthy(
      serverLabel: "NAS", ready: 8, total: 12, failed: 1, checkedAt: .checked(checkedAt)
    )
    XCTAssertEqual(
      MikanSubscriptionBarModel.segments(for: variant, now: now),
      ["NAS", "8/12 就绪", "1 失败", "2 分钟前检查"]
    )
  }

  func testSegmentsForNeverCheckedOmitFailedCountWhenZero() {
    let variant = MikanSubscriptionBarVariant.healthy(
      serverLabel: "NAS", ready: 0, total: 3, failed: 0, checkedAt: .never
    )
    XCTAssertEqual(
      MikanSubscriptionBarModel.segments(for: variant, now: .now),
      ["NAS", "0/3 就绪", "从未检查"]
    )
  }

  func testSegmentsForCheckFailingVariant() {
    let variant = MikanSubscriptionBarVariant.checkFailing(
      serverLabel: "NAS", checkError: "connection refused", consecutiveFailures: 4
    )
    XCTAssertEqual(
      MikanSubscriptionBarModel.segments(for: variant, now: .now),
      ["NAS", "RSS 抓取失败 · 连续 4 次"]
    )
  }

  func testSegmentsForOfflineVariant() {
    let checkedAt = Date(timeIntervalSince1970: 0)
    let now = checkedAt.addingTimeInterval(3700)
    let variant = MikanSubscriptionBarVariant.offline(serverLabel: "NAS", checkedAt: checkedAt)
    XCTAssertEqual(
      MikanSubscriptionBarModel.segments(for: variant, now: now),
      ["NAS", "上次同步 1 小时前"]
    )
  }

  func testSegmentsForNeedsRepairingVariant() {
    let variant = MikanSubscriptionBarVariant.needsRepairing(serverLabel: "NAS")
    XCTAssertEqual(
      MikanSubscriptionBarModel.segments(for: variant, now: .now),
      ["NAS", "需要重新配对"]
    )
  }
}
