import Foundation
import XCTest

@testable import Torrent_Vibe

final class TorrentShareInboxTests: XCTestCase {
  func testMagnetShareIsConsumedExactlyOnce() throws {
    let directory = makeTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let inbox = TorrentShareInbox(containerURL: directory)
    let magnet =
      "  magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Shared  "

    try inbox.stage(TorrentSharePayload(source: .link(magnet)))

    let payload = try XCTUnwrap(inbox.consume())
    guard case .link(let value) = payload.source else {
      return XCTFail("Expected a shared link")
    }
    XCTAssertEqual(
      value,
      "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Shared"
    )
    XCTAssertNil(try inbox.consume())
  }

  func testTorrentFileSharePreservesNameAndBytes() throws {
    let directory = makeTemporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let inbox = TorrentShareInbox(containerURL: directory)
    let data = Data("d4:infod4:name6:sharedee".utf8)

    try inbox.stage(
      TorrentSharePayload(source: .file(name: "Shared Release.torrent", data: data))
    )

    let payload = try XCTUnwrap(inbox.consume())
    guard case .file(let name, let consumedData) = payload.source else {
      return XCTFail("Expected a shared Torrent file")
    }
    XCTAssertEqual(name, "Shared Release.torrent")
    XCTAssertEqual(consumedData, data)
  }

  func testInvalidSharedSourcesAreRejectedBeforeStaging() {
    XCTAssertThrowsError(try TorrentSharePayload(source: .link("https:///missing-host")))
    XCTAssertThrowsError(
      try TorrentSharePayload(source: .file(name: "notes.txt", data: Data("x".utf8)))
    )
  }

  private func makeTemporaryDirectory() -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(
      "TorrentShareInboxTests-\(UUID().uuidString)",
      isDirectory: true
    )
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
}
