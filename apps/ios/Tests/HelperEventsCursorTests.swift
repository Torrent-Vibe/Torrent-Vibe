import Foundation
import XCTest

@testable import Torrent_Vibe

final class HelperEventsCursorTests: XCTestCase {
  private func event(_ seq: UInt64) -> HelperEvent {
    HelperEvent(
      seq: seq,
      at: Date(timeIntervalSince1970: TimeInterval(seq)),
      level: "info",
      kind: "poll",
      replicaId: nil,
      bangumiId: nil,
      subgroupId: nil,
      episodeId: nil,
      message: "m\(seq)",
      fields: nil
    )
  }

  func testAppendsFreshPageAfterHeldEventsPreservingOrder() {
    let held = [event(1), event(2)]
    let page = [event(3), event(4)]
    XCTAssertEqual(
      HelperEventsCursor.merge(held: held, page: page).map(\.seq), [1, 2, 3, 4])
  }

  func testEmptyPageReturnsHeldListUnchanged() {
    let held = [event(1), event(2)]
    XCTAssertEqual(HelperEventsCursor.merge(held: held, page: []).map(\.seq), [1, 2])
  }

  func testDropsAnySeqFromThePageThatIsAlreadyHeldNeverDuplicating() {
    let held = [event(1), event(2), event(3)]
    let page = [event(2), event(3), event(4)]
    let merged = HelperEventsCursor.merge(held: held, page: page)
    XCTAssertEqual(merged.map(\.seq), [1, 2, 3, 4])
    XCTAssertEqual(Set(merged.map(\.seq)).count, merged.count, "no seq should repeat")
  }

  func testSurvivesAPageWhoseEventsAreEntirelyOlderThanWhatIsHeld() {
    let held = [event(5), event(6)]
    let page = [event(1), event(2)]
    XCTAssertEqual(HelperEventsCursor.merge(held: held, page: page).map(\.seq), [5, 6])
  }

  func testCapsTheHeldListAtMaxHeldEventsEvictingTheOldestFirst() {
    let held = (1...HelperEventsCursor.maxHeldEvents).map { event(UInt64($0)) }
    let page = [event(UInt64(HelperEventsCursor.maxHeldEvents + 1))]
    let merged = HelperEventsCursor.merge(held: held, page: page)
    XCTAssertEqual(merged.count, HelperEventsCursor.maxHeldEvents)
    XCTAssertEqual(merged.first?.seq, 2)
    XCTAssertEqual(merged.last?.seq, UInt64(HelperEventsCursor.maxHeldEvents + 1))
  }
}
