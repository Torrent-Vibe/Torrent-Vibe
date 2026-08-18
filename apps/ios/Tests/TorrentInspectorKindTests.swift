import XCTest

@testable import Torrent_Vibe

final class TorrentInspectorKindTests: XCTestCase {
  func testInspectorKindsUseSingleLineDisclosureTitles() {
    XCTAssertEqual(
      TorrentInspectorKind.allCases.map(\.title),
      ["文件", "Tracker", "Peer"]
    )
  }

  func testUnlimitedSpeedLimitUsesSystemCopy() {
    XCTAssertEqual(TorrentInput.formattedSpeedLimit(0), "不限制")
  }
}
