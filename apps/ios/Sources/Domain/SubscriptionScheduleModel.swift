import Foundation

enum SubscriptionBadge: Equatable, Sendable {
  case failureRetry
  case newEpisodes
  case syncing

  var title: String {
    switch self {
    case .failureRetry: String(localized: "失败 · 重试")
    case .newEpisodes: String(localized: "有新集")
    case .syncing: String(localized: "同步中")
    }
  }
}

struct SubscriptionScheduleEntry: Equatable, Identifiable, Sendable {
  let group: HelperSubscriptionGroup
  let mikanWeekday: Int?
  let coverURLString: String?
  let episodeCount: Int
  let hasNewEpisodes: Bool

  var id: String { group.id }

  var badge: SubscriptionBadge? {
    let states = group.targets.flatMap { $0.episodes.map(\.state) }
    if states.contains(.failed) || states.contains(.needsManual) { return .failureRetry }
    if hasNewEpisodes { return .newEpisodes }
    if states.contains(where: Self.activeStates.contains) { return .syncing }
    return nil
  }

  private static let activeStates: Set<HelperEpisodeState> = [
    .pending, .added, .downloading, .renaming,
  ]
}

struct SubscriptionDaySection: Equatable, Identifiable, Sendable {
  let mikanWeekday: Int
  let daysFromToday: Int
  let date: Date
  let entries: [SubscriptionScheduleEntry]

  var id: Int { mikanWeekday }
}

struct SubscriptionSchedule: Equatable, Sendable {
  let sections: [SubscriptionDaySection]
  let unscheduled: [SubscriptionScheduleEntry]
  let totalCount: Int
  let newCount: Int

  var daysWithNewEpisodes: Set<Int> {
    Set(
      sections
        .filter { $0.entries.contains(where: \.hasNewEpisodes) }
        .map(\.mikanWeekday)
    )
  }

  func entries(mikanWeekday: Int) -> [SubscriptionScheduleEntry] {
    sections.first { $0.mikanWeekday == mikanWeekday }?.entries ?? []
  }
}

enum SubscriptionScheduleModel {
  static func episodeCount(in group: HelperSubscriptionGroup) -> Int {
    var ids = Set<String>()
    for target in group.targets {
      for episode in target.episodes {
        ids.insert(episode.episodeId)
      }
    }
    return ids.count
  }

  static func build(
    groups: [HelperSubscriptionGroup],
    directory: [String: MikanBangumiCard],
    seenCounts: [String: Int],
    calendar: Calendar = .current,
    now: Date = .now
  ) -> SubscriptionSchedule {
    let today = mikanWeekday(for: now, calendar: calendar)
    let startOfToday = calendar.startOfDay(for: now)

    var byWeekday: [Int: [SubscriptionScheduleEntry]] = [:]
    var unscheduled: [SubscriptionScheduleEntry] = []
    var newCount = 0

    for group in groups {
      let card = directory[group.replica.bangumiId]
      let count = episodeCount(in: group)
      let hasNew = seenCounts[group.id].map { count > $0 } ?? false
      if hasNew { newCount += 1 }
      let entry = SubscriptionScheduleEntry(
        group: group,
        mikanWeekday: normalizedWeekday(card?.weekday),
        coverURLString: card?.coverUrl,
        episodeCount: count,
        hasNewEpisodes: hasNew
      )
      if let weekday = entry.mikanWeekday {
        byWeekday[weekday, default: []].append(entry)
      } else {
        unscheduled.append(entry)
      }
    }

    let sections = (0..<7).map { offset -> SubscriptionDaySection in
      let weekday = (today + offset) % 7
      let date = calendar.date(byAdding: .day, value: offset, to: startOfToday) ?? startOfToday
      return SubscriptionDaySection(
        mikanWeekday: weekday,
        daysFromToday: offset,
        date: date,
        entries: byWeekday[weekday] ?? []
      )
    }

    return SubscriptionSchedule(
      sections: sections,
      unscheduled: unscheduled,
      totalCount: groups.count,
      newCount: newCount
    )
  }

  static func mikanWeekday(for date: Date, calendar: Calendar) -> Int {
    let weekday = calendar.component(.weekday, from: date)
    return weekday == 1 ? 0 : weekday - 1
  }

  static func normalizedWeekday(_ value: Int?) -> Int? {
    guard let value, (0...6).contains(value) else { return nil }
    return value
  }

  static func mergedCard(
    _ existing: MikanBangumiCard?,
    incoming: MikanBangumiCard
  ) -> MikanBangumiCard {
    guard let existing else { return incoming }
    return MikanBangumiCard(
      bangumiId: incoming.bangumiId,
      coverUrl: incoming.coverUrl ?? existing.coverUrl,
      title: incoming.title.isEmpty ? existing.title : incoming.title,
      weekday: normalizedWeekday(incoming.weekday) != nil ? incoming.weekday : existing.weekday
    )
  }
}
