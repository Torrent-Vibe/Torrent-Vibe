import Foundation
import XCTest

@testable import Torrent_Vibe

final class HelperEventFieldsDecodingTests: XCTestCase {
  private func decodeEvent(json: [String: Any]) throws -> HelperEvent {
    let data = try JSONSerialization.data(withJSONObject: json)
    return try JSONDecoder().decode(HelperEvent.self, from: data)
  }

  private func baseJSON(fields: [String: Any]? = nil) -> [String: Any] {
    var json: [String: Any] = [
      "seq": 1,
      "at": "2026-08-20T12:00:00Z",
      "level": "info",
      "kind": "rss.fetch",
      "message": "已检查",
    ]
    if let fields {
      json["fields"] = fields
    }
    return json
  }

  func testDecodesAStringFieldValue() throws {
    let event = try decodeEvent(json: baseJSON(fields: ["reason": "rival-release"]))
    XCTAssertEqual(event.fields?["reason"], .string("rival-release"))
  }

  func testDecodesANumberFieldValue() throws {
    let event = try decodeEvent(json: baseJSON(fields: ["httpStatus": 403]))
    XCTAssertEqual(event.fields?["httpStatus"], .number(403))
  }

  func testDecodesABooleanFieldValue() throws {
    let event = try decodeEvent(json: baseJSON(fields: ["ok": true]))
    XCTAssertEqual(event.fields?["ok"], .bool(true))
  }

  func testDecodesAMixOfFieldValueTypesInOneEvent() throws {
    let event = try decodeEvent(
      json: baseJSON(fields: ["httpStatus": 200, "itemCount": 3, "cached": false, "url": "https://mikan.test/rss"]))
    XCTAssertEqual(event.fields?["httpStatus"], .number(200))
    XCTAssertEqual(event.fields?["itemCount"], .number(3))
    XCTAssertEqual(event.fields?["cached"], .bool(false))
    XCTAssertEqual(event.fields?["url"], .string("https://mikan.test/rss"))
  }

  func testLegacyEventWithNoFieldsKeyDecodesToNilFields() throws {
    let event = try decodeEvent(json: baseJSON())
    XCTAssertNil(event.fields)
  }

  func testFieldsRoundTripThroughEncodeAndDecode() throws {
    let original = HelperEvent(
      seq: 9,
      at: Date(timeIntervalSince1970: 100),
      level: "warn",
      kind: "episode.skip",
      replicaId: nil,
      bangumiId: nil,
      subgroupId: nil,
      episodeId: nil,
      message: "跳过",
      fields: ["reason": .string("dup"), "rival": .string("LoliHouse")]
    )
    let data = try JSONEncoder().encode(original)
    let decoded = try JSONDecoder().decode(HelperEvent.self, from: data)
    XCTAssertEqual(decoded.fields, original.fields)
  }
}
