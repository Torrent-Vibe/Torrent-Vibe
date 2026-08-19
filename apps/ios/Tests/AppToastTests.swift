import UIKit
import XCTest

@testable import Torrent_Vibe

final class AppToastTests: XCTestCase {
  func testPhoneWithTallTopInsetHasDynamicIsland() {
    XCTAssertTrue(
      AppToastLayout.hasDynamicIsland(idiom: .phone, portraitTopInset: 62)
    )
    XCTAssertTrue(
      AppToastLayout.hasDynamicIsland(idiom: .phone, portraitTopInset: 59)
    )
  }

  func testNotchPhoneAndPadDoNotHaveDynamicIsland() {
    XCTAssertFalse(
      AppToastLayout.hasDynamicIsland(idiom: .phone, portraitTopInset: 47)
    )
    XCTAssertFalse(
      AppToastLayout.hasDynamicIsland(idiom: .pad, portraitTopInset: 24)
    )
  }

  func testIdleIslandUsesMorphPlacement() {
    XCTAssertEqual(
      AppToastLayout.placement(hasDynamicIsland: true, islandOccupied: false),
      .islandMorph
    )
  }

  func testOccupiedIslandHangsBelow() {
    XCTAssertEqual(
      AppToastLayout.placement(hasDynamicIsland: true, islandOccupied: true),
      .hangBelowIsland
    )
  }

  func testMissingIslandUsesTopCapsule() {
    XCTAssertEqual(
      AppToastLayout.placement(hasDynamicIsland: false, islandOccupied: false),
      .topCapsule
    )
  }

  func testIslandFrameIsCenteredAndLeavesHardwareClearance() {
    let screen = CGSize(width: 402, height: 874)
    let island = AppToastLayout.islandFrame(in: screen)
    XCTAssertEqual(island.width, 126, accuracy: 0.5)
    XCTAssertEqual(island.height, 37, accuracy: 0.5)
    XCTAssertEqual(island.midX, screen.width / 2, accuracy: 0.5)
    XCTAssertEqual(island.minY, 12, accuracy: 0.5)
  }

  func testMorphExpandedFrameSitsBelowIslandWithGap() {
    let screen = CGSize(width: 402, height: 874)
    let island = AppToastLayout.islandFrame(in: screen)
    let expanded = AppToastLayout.expandedFrame(in: screen, placement: .islandMorph)
    XCTAssertEqual(expanded.minY, island.maxY + AppToastLayout.islandGap, accuracy: 0.5)
    XCTAssertEqual(expanded.midX, island.midX, accuracy: 0.5)
    XCTAssertFalse(expanded.intersects(island))
    XCTAssertGreaterThanOrEqual(expanded.height, 56)
  }

  func testHangBelowFrameDoesNotCoverTheIsland() {
    let screen = CGSize(width: 402, height: 874)
    let island = AppToastLayout.islandFrame(in: screen)
    let hanging = AppToastLayout.expandedFrame(in: screen, placement: .hangBelowIsland)
    XCTAssertEqual(hanging.minY, island.maxY + AppToastLayout.islandGap, accuracy: 0.5)
    XCTAssertFalse(hanging.intersects(island))
  }

  @MainActor
  func testMorphLeavesTheIslandAndDoesNotReoccupyIt() {
    let screen = CGSize(width: 402, height: 874)
    let island = AppToastLayout.islandFrame(in: screen)
    let state = AppToastState(
      message: "已开始持续订阅",
      placement: .islandMorph,
      screenSize: screen,
      reduceMotion: false
    )
    XCTAssertEqual(state.currentFrame, island)
    state.phase = .expanded
    XCTAssertGreaterThan(state.currentFrame.minY, island.maxY)
    XCTAssertFalse(state.currentFrame.intersects(island))
  }
}
