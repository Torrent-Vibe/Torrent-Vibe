import Foundation
import XCTest

@testable import Torrent_Vibe

final class TorrentFilterTests: XCTestCase {
  private func torrent(status: TorrentStatus) -> TorrentSummary {
    TorrentSummary(
      id: UUID().uuidString,
      name: "task",
      progress: 0.5,
      size: "1 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "—",
      status: status
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
}
