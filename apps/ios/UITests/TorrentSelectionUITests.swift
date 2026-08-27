import XCTest

final class TorrentSelectionUITests: XCTestCase {
  private let activeSpeedValue = "下载 18.4 MB/s，上传 5.9 MB/s"

  @MainActor
  func testTransferAccessoryYieldsToSelectionMode() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let transferAccessory = app.otherElements["torrent-transfer-accessory"]
    XCTAssertTrue(transferAccessory.waitForExistence(timeout: 10))
    XCTAssertEqual(transferAccessory.value as? String, activeSpeedValue)
    XCTAssertTrue(app.navigationBars.staticTexts["任务"].exists)

    let selectButton = app.buttons["torrent-select"]
    XCTAssertTrue(selectButton.waitForExistence(timeout: 5))
    selectButton.tap()
    XCTAssertTrue(app.navigationBars.staticTexts["选择任务"].waitForExistence(timeout: 5))
    XCTAssertFalse(transferAccessory.exists)

    app.buttons["torrent-select-done"].tap()
    XCTAssertTrue(transferAccessory.waitForExistence(timeout: 5))
    XCTAssertEqual(transferAccessory.value as? String, activeSpeedValue)
  }

  @MainActor
  func testTransferAccessoryIsHiddenWhenTransfersAreIdle() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo", "-ui-demo-idle-transfers"]
    app.launch()

    XCTAssertTrue(app.navigationBars.staticTexts["任务"].waitForExistence(timeout: 10))
    XCTAssertFalse(app.otherElements["torrent-transfer-accessory"].exists)
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

    XCTAssertTrue(app.staticTexts["已选 20"].waitForExistence(timeout: 5))
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
    let downloadingChip = app.buttons["torrent-filter-chip-downloading"]
    XCTAssertTrue(allChip.waitForExistence(timeout: 10))

    let forwardStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.38))
    let forwardEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.38))
    forwardStart.press(forDuration: 0.05, thenDragTo: forwardEnd)

    XCTAssertTrue(downloadingChip.waitForExistence(timeout: 5))
    XCTAssertTrue(downloadingChip.isSelected)
    XCTAssertFalse(allChip.isSelected)
    XCTAssertTrue(app.buttons["torrent-row-demo-blue-planet"].exists)
    XCTAssertFalse(app.buttons["torrent-row-demo-frieren"].exists)

    let reverseStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.38))
    let reverseEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.38))
    reverseStart.press(forDuration: 0.05, thenDragTo: reverseEnd)

    XCTAssertTrue(allChip.isSelected)
    XCTAssertFalse(downloadingChip.isSelected)
    XCTAssertTrue(app.buttons["torrent-row-demo-frieren"].waitForExistence(timeout: 5))
  }

  @MainActor
  func testAddTorrentUsesTwoStepsAndLoadsServerCategories() throws {
    let app = XCUIApplication()
    app.launchArguments = ["-ui-demo"]
    app.launch()

    let addButton = app.buttons["torrent-add"]
    XCTAssertTrue(addButton.waitForExistence(timeout: 10))
    addButton.tap()

    let source = app.textFields["torrent-import-source"]
    XCTAssertTrue(source.waitForExistence(timeout: 5))
    let magnet = "magnet:?xt=urn:btih:0123456789ABCDEF0123456789ABCDEF01234567"
    source.tap()
    source.typeText(magnet)

    let next = app.buttons["torrent-import-next"]
    XCTAssertTrue(next.isEnabled)
    next.tap()

    let category = app.buttons["torrent-import-category"]
    XCTAssertTrue(category.waitForExistence(timeout: 5))
    category.tap()
    let anime = app.buttons["anime"]
    XCTAssertTrue(anime.waitForExistence(timeout: 5))
    anime.tap()
    let categoryPath = app.staticTexts["torrent-import-category-path"]
    XCTAssertTrue(categoryPath.waitForExistence(timeout: 5))
    XCTAssertTrue(categoryPath.label.contains("/Media/Anime"))

    app.buttons["torrent-import-back"].tap()
    XCTAssertTrue(source.waitForExistence(timeout: 5))
    XCTAssertEqual(source.value as? String, magnet)
  }
}
