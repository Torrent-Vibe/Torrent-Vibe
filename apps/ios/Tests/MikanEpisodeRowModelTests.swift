import Foundation
import XCTest

@testable import Torrent_Vibe

final class MikanEpisodeRowModelTests: XCTestCase {
  func testBadgeToneForEveryEpisodeState() {
    let expected: [HelperEpisodeState: MikanEpisodeBadgeTone] = [
      .pending: .neutral,
      .added: .neutral,
      .downloading: .accent,
      .renaming: .accent,
      .done: .success,
      .failed: .destructive,
      .needsManual: .warning,
      .skipped: .muted,
    ]
    for (state, tone) in expected {
      XCTAssertEqual(
        MikanEpisodeBadgeModel.badge(for: state).tone, tone,
        "\(state) should map to \(tone)"
      )
    }
  }

  func testBadgeTitleMatchesStateTitle() {
    XCTAssertEqual(MikanEpisodeBadgeModel.badge(for: .failed).title, HelperEpisodeState.failed.title)
  }

  private func torrent(hash: String, progress: Double = 0.5) -> TorrentSummary {
    TorrentSummary(
      id: hash,
      name: "test",
      progress: progress,
      size: "1 GB",
      downloadSpeed: "1 MB/s",
      uploadSpeed: "0 B/s",
      eta: "1 分钟",
      status: .downloading
    )
  }

  func testInfohashJoinMatchesWhenTorrentHashIsUppercaseAndInfohashIsLowercase() {
    let index = MikanEpisodeTorrentIndex(torrents: [torrent(hash: "ABCDEF1234", progress: 0.42)])
    let matched = index.torrent(forInfohash: "abcdef1234")
    XCTAssertEqual(matched?.id, "ABCDEF1234")
  }

  func testInfohashJoinMatchesWhenTorrentHashIsLowercaseAndInfohashIsUppercase() {
    let index = MikanEpisodeTorrentIndex(torrents: [torrent(hash: "abcdef1234", progress: 0.42)])
    let matched = index.torrent(forInfohash: "ABCDEF1234")
    XCTAssertEqual(matched?.id, "abcdef1234")
  }

  func testInfohashJoinReturnsNilWhenNoMatch() {
    let index = MikanEpisodeTorrentIndex(torrents: [torrent(hash: "abcdef1234")])
    XCTAssertNil(index.torrent(forInfohash: "zzzzzz"))
  }

  func testInfohashJoinReturnsNilWhenInfohashIsNil() {
    let index = MikanEpisodeTorrentIndex(torrents: [torrent(hash: "abcdef1234")])
    XCTAssertNil(index.torrent(forInfohash: nil))
  }

  func testLiveProgressTextRoundsPercent() {
    XCTAssertEqual(MikanEpisodeLiveProgress.percentText(for: torrent(hash: "a", progress: 0.426)), "43%")
  }

  func testRowModelShowsLiveProgressOnlyWhenDownloading() {
    let index = MikanEpisodeTorrentIndex(torrents: [torrent(hash: "abc123", progress: 0.5)])
    let downloading = MikanEpisodeRowModelBuilder.build(
      state: .downloading, infohash: "ABC123", subscribed: true, torrentIndex: index
    )
    XCTAssertEqual(downloading.liveProgressText, "50%")

    let done = MikanEpisodeRowModelBuilder.build(
      state: .done, infohash: "ABC123", subscribed: true, torrentIndex: index
    )
    XCTAssertNil(done.liveProgressText, "live progress should only render for downloading episodes")
  }

  func testRowModelHasNoRemedyForNonRemedyStatesWhenSubscribed() {
    let index = MikanEpisodeTorrentIndex(torrents: [])
    for state: HelperEpisodeState in [.pending, .added, .downloading, .renaming, .done] {
      let model = MikanEpisodeRowModelBuilder.build(
        state: state, infohash: nil, subscribed: true, torrentIndex: index
      )
      XCTAssertNil(model.remedy, "\(state) must not show a remedy action while subscribed")
    }
  }

  func testRowModelShowsRetryOnlyForFailedWhenSubscribed() {
    let index = MikanEpisodeTorrentIndex(torrents: [])
    let model = MikanEpisodeRowModelBuilder.build(
      state: .failed, infohash: nil, subscribed: true, torrentIndex: index
    )
    XCTAssertEqual(model.remedy, .retry)
  }

  func testRowModelShowsDownloadAnywayForSkippedAndNeedsManualWhenSubscribed() {
    let index = MikanEpisodeTorrentIndex(torrents: [])
    for state: HelperEpisodeState in [.skipped, .needsManual] {
      let model = MikanEpisodeRowModelBuilder.build(
        state: state, infohash: nil, subscribed: true, torrentIndex: index
      )
      XCTAssertEqual(model.remedy, .downloadAnyway, "\(state) must show '仍要下载' only")
    }
  }

  func testRowModelKeepsImportActionOnEveryRowWhenUnsubscribed() {
    let index = MikanEpisodeTorrentIndex(torrents: [])
    let allStates: [HelperEpisodeState?] = [
      nil, .pending, .added, .downloading, .renaming, .done, .failed, .needsManual, .skipped,
    ]
    for state in allStates {
      let model = MikanEpisodeRowModelBuilder.build(
        state: state, infohash: nil, subscribed: false, torrentIndex: index
      )
      XCTAssertEqual(model.remedy, .importEpisode, "\(String(describing: state)) must keep the import action when unsubscribed")
    }
  }
}
