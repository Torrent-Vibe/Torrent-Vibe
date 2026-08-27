import Foundation
import XCTest

@testable import Torrent_Vibe

final class TorrentFilterTests: XCTestCase {
  private func torrent(
    status: TorrentStatus,
    statusGroup: TorrentStatusGroup? = nil
  ) -> TorrentSummary {
    TorrentSummary(
      id: UUID().uuidString,
      name: "task",
      progress: 0.5,
      size: "1 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "—",
      status: status,
      statusGroup: statusGroup
    )
  }

  func testCountsTasksInEveryStatusBucket() {
    let torrents = [
      torrent(status: .downloading),
      torrent(status: .downloading),
      torrent(status: .seeding),
      torrent(status: .completed),
      torrent(status: .paused),
      torrent(status: .error),
    ]

    let counts = TorrentFilterCounting.counts(for: torrents)

    XCTAssertEqual(counts[.all], 6)
    XCTAssertEqual(counts[.downloading], 2)
    XCTAssertEqual(counts[.seeding], 1)
    XCTAssertEqual(counts[.completed], 1)
    XCTAssertEqual(counts[.paused], 1)
    XCTAssertEqual(counts[.error], 1)
  }

  func testQueuedTasksAreOnlyCountedUnderAll() {
    let torrents = [torrent(status: .queued)]

    let counts = TorrentFilterCounting.counts(for: torrents)

    XCTAssertEqual(counts[.all], 1)
    XCTAssertEqual(counts[.downloading], 0)
    XCTAssertEqual(counts[.paused], 0)
  }

  func testDesktopStatusGroupBoundariesDriveVisibleFilters() {
    let queuedDownload = torrent(
      status: .queued,
      statusGroup: TorrentStatusGroup(qbittorrentState: "queuedDL")
    )
    let queuedUpload = torrent(
      status: .queued,
      statusGroup: TorrentStatusGroup(qbittorrentState: "queuedUP")
    )
    let checkingUpload = torrent(
      status: .queued,
      statusGroup: TorrentStatusGroup(qbittorrentState: "checkingUP")
    )
    let pausedUpload = torrent(
      status: .paused,
      statusGroup: TorrentStatusGroup(qbittorrentState: "pausedUP")
    )
    let pausedDownload = torrent(
      status: .paused,
      statusGroup: TorrentStatusGroup(qbittorrentState: "pausedDL")
    )
    let missingFiles = torrent(
      status: .error,
      statusGroup: TorrentStatusGroup(qbittorrentState: "missingFiles")
    )
    let checkingDownload = torrent(
      status: .queued,
      statusGroup: TorrentStatusGroup(qbittorrentState: "checkingDL")
    )

    XCTAssertTrue(TorrentFilter.downloading.includes(queuedDownload))
    XCTAssertTrue(TorrentFilter.seeding.includes(queuedUpload))
    XCTAssertTrue(TorrentFilter.completed.includes(checkingUpload))
    XCTAssertTrue(TorrentFilter.completed.includes(pausedUpload))
    XCTAssertFalse(TorrentFilter.paused.includes(pausedUpload))
    XCTAssertTrue(TorrentFilter.paused.includes(pausedDownload))
    XCTAssertTrue(TorrentFilter.error.includes(missingFiles))
    XCTAssertFalse(TorrentFilter.allCases.dropFirst().contains { $0.includes(checkingDownload) })
  }

  @MainActor
  func testLastSelectedFilterIsRestoredUnlessRememberingIsDisabled() {
    let suiteName = "TorrentFilterTests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suiteName)!
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let serverID = UUID()

    let firstLaunch = TorrentSearchState(defaults: defaults)
    firstLaunch.activate(serverID: serverID)
    firstLaunch.select(.downloading)

    let relaunched = TorrentSearchState(defaults: defaults)
    relaunched.activate(serverID: serverID)
    XCTAssertEqual(relaunched.filter, .downloading)

    defaults.set(false, forKey: TorrentFilter.remembersLastSelectionStorageKey)
    let disabled = TorrentSearchState(defaults: defaults)
    disabled.activate(serverID: serverID)
    XCTAssertEqual(disabled.filter, .all)
  }
}
