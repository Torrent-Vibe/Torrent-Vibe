import Foundation
import XCTest

@testable import Torrent_Vibe

final class SubscriptionScheduleModelTests: XCTestCase {
  private let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
  }()

  private var now: Date {
    calendar.date(from: DateComponents(year: 2026, month: 8, day: 22, hour: 12))!
  }

  func testSectionsStartAtTodayAndWrapAroundWeek() {
    let schedule = SubscriptionScheduleModel.build(
      groups: [
        group(bangumi: "sat", weekday: 6),
        group(bangumi: "sun", weekday: 0),
        group(bangumi: "wed", weekday: 3),
      ],
      directory: directory(for: ["sat": 6, "sun": 0, "wed": 3]),
      seenCounts: [:],
      calendar: calendar,
      now: now
    )

    XCTAssertEqual(schedule.sections.map(\.mikanWeekday), [6, 0, 1, 2, 3, 4, 5])
    XCTAssertEqual(schedule.sections.map(\.daysFromToday), [0, 1, 2, 3, 4, 5, 6])
    XCTAssertEqual(schedule.sections[0].entries.map(\.id), ["sat:sub"])
    XCTAssertEqual(schedule.sections[1].entries.map(\.id), ["sun:sub"])
    XCTAssertEqual(schedule.sections[4].entries.map(\.id), ["wed:sub"])
    XCTAssertTrue(schedule.unscheduled.isEmpty)
  }

  func testUnknownWeekdayGoesToUnscheduled() {
    let schedule = SubscriptionScheduleModel.build(
      groups: [group(bangumi: "unknown", weekday: nil)],
      directory: [:],
      seenCounts: [:],
      calendar: calendar,
      now: now
    )

    XCTAssertTrue(schedule.sections.allSatisfy(\.entries.isEmpty))
    XCTAssertEqual(schedule.unscheduled.map(\.id), ["unknown:sub"])
  }

  func testFailureBadgeTakesPrecedenceOverNewEpisodes() {
    let entry = entry(
      bangumi: "show",
      episodes: [episode("e1", state: .failed), episode("e2", state: .done)],
      seenCount: 1
    )

    XCTAssertEqual(entry.badge, .failureRetry)
  }

  func testNewEpisodesBadgeWhenBaselineExceeded() {
    let entry = entry(
      bangumi: "show",
      episodes: [episode("e1"), episode("e2")],
      seenCount: 1
    )

    XCTAssertEqual(entry.badge, .newEpisodes)
    XCTAssertTrue(entry.hasNewEpisodes)
  }

  func testSyncingBadgeForActiveStatesWithoutNewEpisodes() {
    let entry = entry(
      bangumi: "show",
      episodes: [episode("e1", state: .downloading)],
      seenCount: nil
    )

    XCTAssertEqual(entry.badge, .syncing)
    XCTAssertFalse(entry.hasNewEpisodes)
  }

  func testNoBadgeWhenEverythingDoneAndSeen() {
    let entry = entry(
      bangumi: "show",
      episodes: [episode("e1"), episode("e2")],
      seenCount: 2
    )

    XCTAssertNil(entry.badge)
  }

  func testMissingBaselineNeverReportsNewEpisodes() {
    let schedule = SubscriptionScheduleModel.build(
      groups: [group(bangumi: "show", weekday: 6, episodes: [episode("e1")])],
      directory: directory(for: ["show": 6]),
      seenCounts: [:],
      calendar: calendar,
      now: now
    )

    XCTAssertFalse(schedule.sections[0].entries[0].hasNewEpisodes)
    XCTAssertEqual(schedule.newCount, 0)
  }

  func testNewCountAggregatesAcrossGroups() {
    let schedule = SubscriptionScheduleModel.build(
      groups: [
        group(bangumi: "a", weekday: 6, episodes: [episode("a1"), episode("a2")]),
        group(bangumi: "b", weekday: 0, episodes: [episode("b1")]),
      ],
      directory: directory(for: ["a": 6, "b": 0]),
      seenCounts: ["a:sub": 1, "b:sub": 2],
      calendar: calendar,
      now: now
    )

    XCTAssertEqual(schedule.newCount, 1)
    XCTAssertEqual(schedule.totalCount, 2)
    XCTAssertEqual(schedule.daysWithNewEpisodes, [6])
  }

  func testEpisodeCountDeduplicatesAcrossServers() {
    let group = HelperSubscriptionGroup(
      replica: replica(bangumi: "show"),
      targets: [
        target(episodes: [episode("e1"), episode("e2")]),
        target(episodes: [episode("e1"), episode("e3")]),
      ]
    )

    XCTAssertEqual(SubscriptionScheduleModel.episodeCount(in: group), 3)
  }

  func testSingleDayLookupReturnsOnlyThatDay() {
    let schedule = SubscriptionScheduleModel.build(
      groups: [
        group(bangumi: "sat", weekday: 6),
        group(bangumi: "sun", weekday: 0),
      ],
      directory: directory(for: ["sat": 6, "sun": 0]),
      seenCounts: [:],
      calendar: calendar,
      now: now
    )

    XCTAssertEqual(schedule.entries(mikanWeekday: 6).map(\.id), ["sat:sub"])
    XCTAssertEqual(schedule.entries(mikanWeekday: 3), [])
  }

  func testMergedCardKeepsExistingWhenIncomingFieldsAreMissing() {
    let existing = MikanBangumiCard(
      bangumiId: "4102",
      coverUrl: "https://mikan.test/cover.jpg",
      title: "星海列车",
      weekday: 1
    )
    let incoming = MikanBangumiCard(
      bangumiId: "4102",
      coverUrl: nil,
      title: "星海列车",
      weekday: nil
    )

    let merged = SubscriptionScheduleModel.mergedCard(existing, incoming: incoming)

    XCTAssertEqual(merged.coverUrl, existing.coverUrl)
    XCTAssertEqual(merged.weekday, existing.weekday)
  }

  func testMergedCardPrefersIncomingValuesAndRejectsInvalidWeekday() {
    let existing = MikanBangumiCard(
      bangumiId: "4102",
      coverUrl: "https://mikan.test/old.jpg",
      title: "星海列车",
      weekday: 1
    )
    let incoming = MikanBangumiCard(
      bangumiId: "4102",
      coverUrl: "https://mikan.test/new.jpg",
      title: "星海列车",
      weekday: 7
    )

    let merged = SubscriptionScheduleModel.mergedCard(existing, incoming: incoming)

    XCTAssertEqual(merged.coverUrl, incoming.coverUrl)
    XCTAssertEqual(merged.weekday, existing.weekday)
  }

  func testNormalizedWeekdayRejectsOutOfRangeValues() {
    XCTAssertNil(SubscriptionScheduleModel.normalizedWeekday(nil))
    XCTAssertNil(SubscriptionScheduleModel.normalizedWeekday(7))
    XCTAssertNil(SubscriptionScheduleModel.normalizedWeekday(-1))
    XCTAssertEqual(SubscriptionScheduleModel.normalizedWeekday(0), 0)
    XCTAssertEqual(SubscriptionScheduleModel.normalizedWeekday(6), 6)
  }

  @MainActor
  func testSeenCountsAndDirectoryPersistAcrossModelReload() throws {
    let env = try makeMikanTestEnvironment()
    let model = env.makeModel(helperService: DemoHelperService())

    model.markSubscriptionsSeen(["4102:583": 3])
    model.noteMikanCards([
      MikanBangumiCard(
        bangumiId: "4102",
        coverUrl: nil,
        title: "星海列车",
        weekday: 1
      )
    ])

    let reloaded = env.makeModel(helperService: DemoHelperService())
    XCTAssertEqual(reloaded.subscriptionSeenCounts, ["4102:583": 3])
    XCTAssertEqual(reloaded.mikanDirectory["4102"]?.weekday, 1)
    XCTAssertEqual(reloaded.mikanDirectory["4102"]?.title, "星海列车")
  }

  @MainActor
  func testMarkSubscriptionsSeenPrunesStaleGroups() {
    let env = try! makeMikanTestEnvironment()
    let model = env.makeModel(helperService: DemoHelperService())

    model.markSubscriptionsSeen(["old:sub": 1])
    model.markSubscriptionsSeen(["new:sub": 2])

    XCTAssertEqual(model.subscriptionSeenCounts, ["new:sub": 2])
  }

  // MARK: - Builders

  private func episode(_ id: String, state: HelperEpisodeState = .done) -> HelperEpisodeStatus {
    HelperEpisodeStatus(
      episodeId: id,
      title: id,
      season: 1,
      episode: 1,
      state: state,
      infohash: nil,
      lastError: nil
    )
  }

  private func replica(bangumi: String) -> HelperReplica {
    HelperReplica(
      id: "\(bangumi):sub",
      bangumiId: bangumi,
      title: bangumi,
      bangumiSubjectId: nil,
      subgroupId: "sub",
      subgroupName: "Sub",
      rssUrl: "https://mikan.test/rss"
    )
  }

  private func target(episodes: [HelperEpisodeStatus]) -> HelperSubscriptionTarget {
    HelperSubscriptionTarget(
      serverID: UUID(),
      serverName: "NAS",
      replicaID: "replica",
      episodes: episodes
    )
  }

  private func group(
    bangumi: String,
    weekday: Int?,
    episodes: [HelperEpisodeStatus] = []
  ) -> HelperSubscriptionGroup {
    HelperSubscriptionGroup(
      replica: replica(bangumi: bangumi),
      targets: [target(episodes: episodes)]
    )
  }

  private func entry(
    bangumi: String,
    episodes: [HelperEpisodeStatus],
    seenCount: Int?
  ) -> SubscriptionScheduleEntry {
    SubscriptionScheduleEntry(
      group: group(bangumi: bangumi, weekday: 6, episodes: episodes),
      mikanWeekday: 6,
      coverURLString: nil,
      episodeCount: SubscriptionScheduleModel.episodeCount(
        in: group(bangumi: bangumi, weekday: 6, episodes: episodes)
      ),
      hasNewEpisodes: seenCount.map { episodes.count > $0 } ?? false
    )
  }

  private func directory(for weekdays: [String: Int]) -> [String: MikanBangumiCard] {
    weekdays.reduce(into: [:]) { result, pair in
      result[pair.key] = MikanBangumiCard(
        bangumiId: pair.key,
        coverUrl: nil,
        title: pair.key,
        weekday: pair.value
      )
    }
  }
}
