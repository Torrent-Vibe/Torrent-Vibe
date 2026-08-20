import Foundation
import XCTest

@testable import Torrent_Vibe

final class HelperEventsFilterTests: XCTestCase {
  private func event(
    seq: UInt64 = 1,
    level: String = "info",
    message: String = "checked feed",
    replicaId: String? = nil,
    fields: [String: HelperEventFieldValue]? = nil
  ) -> HelperEvent {
    HelperEvent(
      seq: seq,
      at: Date(timeIntervalSince1970: TimeInterval(seq)),
      level: level,
      kind: "poll",
      replicaId: replicaId,
      bangumiId: nil,
      subgroupId: nil,
      episodeId: nil,
      message: message,
      fields: fields
    )
  }

  func testExcludesDebugEventsWhenTheLevelFilterIsInfo() {
    let events = [
      event(seq: 1, level: "debug", message: "debug msg"),
      event(seq: 2, level: "info"),
    ]
    let result = HelperEventsFiltering.apply(events, filter: HelperEventsFilter(level: .info))
    XCTAssertEqual(result.map(\.seq), [2])
  }

  func testIncludesDebugEventsWhenTheLevelFilterOptsIntoDebug() {
    let events = [
      event(seq: 1, level: "debug"),
      event(seq: 2, level: "error"),
    ]
    let result = HelperEventsFiltering.apply(events, filter: HelperEventsFilter(level: .debug))
    XCTAssertEqual(result.map(\.seq), [1, 2])
  }

  func testKeepsWarnAndErrorWhenFilteringAtInfoAndAbove() {
    let events = [
      event(seq: 1, level: "debug"),
      event(seq: 2, level: "info"),
      event(seq: 3, level: "warn"),
      event(seq: 4, level: "error"),
    ]
    let result = HelperEventsFiltering.apply(events, filter: HelperEventsFilter(level: .info))
    XCTAssertEqual(result.map(\.level), ["info", "warn", "error"])
  }

  func testMatchesFreeTextSearchAgainstTheMessageCaseInsensitively() {
    let events = [
      event(seq: 1, message: "RSS fetch failed"),
      event(seq: 2, message: "ok"),
    ]
    let result = HelperEventsFiltering.apply(
      events, filter: HelperEventsFilter(level: .debug, search: "rss fetch"))
    XCTAssertEqual(result.map(\.seq), [1])
  }

  func testMatchesFreeTextSearchAgainstStructuredFields() {
    let events = [
      event(seq: 1, message: "checked", fields: ["status": .number(403)]),
      event(seq: 2, message: "checked", fields: ["status": .number(200)]),
    ]
    let result = HelperEventsFiltering.apply(
      events, filter: HelperEventsFilter(level: .debug, search: "403"))
    XCTAssertEqual(result.map(\.seq), [1])
  }

  func testMatchesFreeTextSearchAgainstReplicaID() {
    let events = [
      event(seq: 1, replicaId: "replica-42"),
      event(seq: 2, replicaId: "other"),
    ]
    let result = HelperEventsFiltering.apply(
      events, filter: HelperEventsFilter(level: .debug, search: "replica-42"))
    XCTAssertEqual(result.map(\.seq), [1])
  }

  func testTreatsABlankSearchAsNoFilter() {
    let events = [event(seq: 1, message: "a"), event(seq: 2, message: "b")]
    let result = HelperEventsFiltering.apply(
      events, filter: HelperEventsFilter(level: .debug, search: "   "))
    XCTAssertEqual(result.map(\.seq), [1, 2])
  }

  func testCombinesTheLevelAndSearchFilters() {
    let events = [
      event(seq: 1, level: "debug", message: "match"),
      event(seq: 2, level: "info", message: "match"),
      event(seq: 3, level: "info", message: "no"),
    ]
    let result = HelperEventsFiltering.apply(
      events, filter: HelperEventsFilter(level: .info, search: "match"))
    XCTAssertEqual(result.map(\.seq), [2])
  }
}
