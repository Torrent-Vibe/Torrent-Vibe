import XCTest

@testable import Torrent_Vibe

@MainActor
final class TorrentLiveActivityStateTests: XCTestCase {
  func testLiveActivityKeepsBackgroundRefreshIndependentOfNotifications() {
    XCTAssertTrue(
      TorrentBackgroundStatusService.shouldScheduleRefresh(
        notificationsEnabled: false,
        hasActiveLiveActivity: true
      ))
    XCTAssertFalse(
      TorrentBackgroundStatusService.shouldScheduleRefresh(
        notificationsEnabled: false,
        hasActiveLiveActivity: false
      ))
  }

  func testForegroundRefreshHonorsThreeSecondSetting() {
    XCTAssertEqual(SceneDelegate.foregroundRefreshInterval(0), 3)
    XCTAssertEqual(SceneDelegate.foregroundRefreshInterval(3), 3)
    XCTAssertEqual(SceneDelegate.foregroundRefreshInterval(10), 10)
  }

  func testContentStatePreservesTransferStatusForIncompleteTorrent() {
    let updatedAt = Date(timeIntervalSince1970: 1_750_000_000)
    let state = TorrentLiveActivityAttributes.ContentState(
      torrent: makeTorrent(
        progress: 0.64,
        status: .downloading,
        downloadSpeed: "18.4 MB/s",
        eta: "8 分钟"
      ),
      updatedAt: updatedAt
    )

    XCTAssertEqual(state.progress, 0.64)
    XCTAssertEqual(state.status, "下载中")
    XCTAssertEqual(state.downloadSpeed, "18.4 MB/s")
    XCTAssertEqual(state.eta, "8 分钟")
    XCTAssertFalse(state.isComplete)
    XCTAssertEqual(state.updatedAt, updatedAt)
  }

  func testContentStateClampsProgressToActivityRange() {
    let belowRange = TorrentLiveActivityAttributes.ContentState(
      torrent: makeTorrent(progress: -0.2, status: .queued)
    )
    let aboveRange = TorrentLiveActivityAttributes.ContentState(
      torrent: makeTorrent(progress: 1.2, status: .downloading)
    )

    XCTAssertEqual(belowRange.progress, 0)
    XCTAssertEqual(aboveRange.progress, 1)
  }

  func testContentStateNormalizesCompletedTorrent() {
    let state = TorrentLiveActivityAttributes.ContentState(
      torrent: makeTorrent(
        progress: 1,
        status: .completed,
        downloadSpeed: "0 B/s",
        eta: "—"
      )
    )

    XCTAssertTrue(state.isComplete)
    XCTAssertEqual(state.status, "已完成")
    XCTAssertEqual(state.eta, "已完成")
  }

  private func makeTorrent(
    progress: Double,
    status: TorrentStatus,
    downloadSpeed: String = "—",
    eta: String = "—"
  ) -> TorrentSummary {
    TorrentSummary(
      id: "live-activity-test",
      name: "The Blue Planet II · 2160p",
      progress: progress,
      size: "9.77 GB",
      downloadSpeed: downloadSpeed,
      uploadSpeed: "74 KB/s",
      eta: eta,
      status: status
    )
  }
}
