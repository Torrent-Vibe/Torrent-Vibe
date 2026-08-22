import XCTest

final class TorrentSelectionUITests: XCTestCase {
  private let activeSpeedSubtitle = "↓ 18.4 MB/s  ↑ 5.9 MB/s"

  @MainActor
  func testNavigationSpeedSubtitleYieldsToSelectionMode() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let speedSubtitle = app.navigationBars.staticTexts[activeSpeedSubtitle]
    XCTAssertTrue(speedSubtitle.waitForExistence(timeout: 10))

    let selectButton = app.buttons["torrent-select"]
    XCTAssertTrue(selectButton.waitForExistence(timeout: 5))
    selectButton.tap()
    XCTAssertTrue(app.navigationBars.staticTexts["选择任务"].waitForExistence(timeout: 5))
    XCTAssertFalse(speedSubtitle.exists)

    app.buttons["torrent-select-done"].tap()
    XCTAssertTrue(speedSubtitle.waitForExistence(timeout: 5))
  }

  @MainActor
  func testNavigationSpeedSubtitleIsHiddenWhenTransfersAreIdle() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo", "-ui-demo-idle-transfers"]
    app.launch()

    XCTAssertTrue(app.navigationBars.staticTexts["任务"].waitForExistence(timeout: 10))
    XCTAssertFalse(app.navigationBars.staticTexts[activeSpeedSubtitle].exists)
    XCTAssertFalse(app.navigationBars.staticTexts["↓ 0 KB/s  ↑ 0 KB/s"].exists)
  }

  @MainActor
  func testSelectAllTogglesAndShowsSelectedCount() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let selectButton = app.buttons["torrent-select"]
    XCTAssertTrue(selectButton.waitForExistence(timeout: 10))
    selectButton.tap()

    let selectAll = app.buttons["torrent-select-all"]
    XCTAssertTrue(selectAll.waitForExistence(timeout: 5))
    selectAll.tap()

    XCTAssertTrue(app.navigationBars.staticTexts["已选 12"].waitForExistence(timeout: 5))
    XCTAssertEqual(app.buttons["torrent-select-all"].label, "取消全选")

    selectAll.tap()
    XCTAssertTrue(app.navigationBars.staticTexts["选择任务"].waitForExistence(timeout: 5))
    XCTAssertEqual(app.buttons["torrent-select-all"].label, "全选")

    let done = app.buttons["torrent-select-done"]
    XCTAssertTrue(done.waitForExistence(timeout: 5))
    done.tap()
    XCTAssertTrue(app.navigationBars.staticTexts["任务"].waitForExistence(timeout: 5))
  }

  @MainActor
  func testFilterChipTapsSelectTheState() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let chip = app.buttons["torrent-filter-chip-downloading"]
    XCTAssertTrue(chip.waitForExistence(timeout: 10))
    chip.tap()

    XCTAssertTrue(chip.isSelected)
    XCTAssertFalse(app.buttons["torrent-filter-chip-all"].isSelected)
  }

  @MainActor
  func testHorizontalPageSwipeSelectsAdjacentFiltersInBothDirections() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let allChip = app.buttons["torrent-filter-chip-all"]
    let completedChip = app.buttons["torrent-filter-chip-completed"]
    XCTAssertTrue(allChip.waitForExistence(timeout: 10))

    let forwardStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.38))
    let forwardEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.38))
    forwardStart.press(forDuration: 0.05, thenDragTo: forwardEnd)

    XCTAssertTrue(completedChip.waitForExistence(timeout: 5))
    XCTAssertTrue(completedChip.isSelected)
    XCTAssertFalse(allChip.isSelected)
    XCTAssertFalse(app.buttons["torrent-row-demo-blue-planet"].exists)

    let reverseStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.38))
    let reverseEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.38))
    reverseStart.press(forDuration: 0.05, thenDragTo: reverseEnd)

    XCTAssertTrue(allChip.isSelected)
    XCTAssertFalse(completedChip.isSelected)
    XCTAssertTrue(app.buttons["torrent-row-demo-blue-planet"].waitForExistence(timeout: 5))
  }
}
