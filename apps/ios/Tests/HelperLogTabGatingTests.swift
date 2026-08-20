import XCTest

@testable import Torrent_Vibe

final class HelperLogTabGatingTests: XCTestCase {
  private func discovery(events: Bool, logs: Bool) -> HelperDiscoveryInfo {
    var capabilities: [String] = []
    if events { capabilities.append("events") }
    if logs { capabilities.append("logs") }
    return HelperDiscoveryInfo(
      version: "2.0.0",
      capabilities: capabilities,
      clientCount: 1,
      requiresPairingCode: true
    )
  }

  func testEventsTabAvailableWheneverEventsCapabilityIsPresentRegardlessOfLogs() {
    XCTAssertEqual(
      HelperLogTabGating.state(for: .events, discovery: discovery(events: true, logs: true)),
      .available)
    XCTAssertEqual(
      HelperLogTabGating.state(for: .events, discovery: discovery(events: true, logs: false)),
      .available)
  }

  func testEventsTabUnavailableWheneverEventsCapabilityIsAbsentRegardlessOfLogs() {
    XCTAssertEqual(
      HelperLogTabGating.state(for: .events, discovery: discovery(events: false, logs: true)),
      .unavailable)
    XCTAssertEqual(
      HelperLogTabGating.state(for: .events, discovery: discovery(events: false, logs: false)),
      .unavailable)
  }

  func testRawTabAvailableWheneverLogsCapabilityIsPresentRegardlessOfEvents() {
    XCTAssertEqual(
      HelperLogTabGating.state(for: .raw, discovery: discovery(events: true, logs: true)),
      .available)
    XCTAssertEqual(
      HelperLogTabGating.state(for: .raw, discovery: discovery(events: false, logs: true)),
      .available)
  }

  func testRawTabUnavailableWheneverLogsCapabilityIsAbsentRegardlessOfEvents() {
    XCTAssertEqual(
      HelperLogTabGating.state(for: .raw, discovery: discovery(events: true, logs: false)),
      .unavailable)
    XCTAssertEqual(
      HelperLogTabGating.state(for: .raw, discovery: discovery(events: false, logs: false)),
      .unavailable)
  }

  func testDefaultTabIsEventsWhenEventsIsSupportedRegardlessOfLogs() {
    XCTAssertEqual(
      HelperLogTabGating.defaultTab(discovery: discovery(events: true, logs: true)), .events)
    XCTAssertEqual(
      HelperLogTabGating.defaultTab(discovery: discovery(events: true, logs: false)), .events)
  }

  func testDefaultTabFallsBackToRawWhenEventsIsUnsupportedButLogsIsSupported() {
    XCTAssertEqual(
      HelperLogTabGating.defaultTab(discovery: discovery(events: false, logs: true)), .raw)
  }

  func testDefaultTabIsEventsWhenNeitherIsSupportedSoTheNoticeHasATabToLandOn() {
    XCTAssertEqual(
      HelperLogTabGating.defaultTab(discovery: discovery(events: false, logs: false)), .events)
  }
}
