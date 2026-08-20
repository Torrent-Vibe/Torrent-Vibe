import Foundation

enum HelperLogLevel: String, CaseIterable, Hashable, Sendable {
  case debug
  case info
  case warn
  case error

  fileprivate var rank: Int {
    switch self {
    case .debug: 0
    case .info: 1
    case .warn: 2
    case .error: 3
    }
  }
}

struct HelperEventsFilter: Hashable, Sendable {
  var level: HelperLogLevel
  var search: String

  init(level: HelperLogLevel = .info, search: String = "") {
    self.level = level
    self.search = search
  }
}

enum HelperEventsFiltering {
  static func apply(_ events: [HelperEvent], filter: HelperEventsFilter) -> [HelperEvent] {
    let minRank = filter.level.rank
    let needle = filter.search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return events.filter { event in
      guard (HelperLogLevel(rawValue: event.level)?.rank ?? 0) >= minRank else { return false }
      guard !needle.isEmpty else { return true }
      return searchHaystack(for: event).contains(needle)
    }
  }

  private static func searchHaystack(for event: HelperEvent) -> String {
    var parts = [event.message, event.kind]
    parts.append(contentsOf: [event.replicaId, event.bangumiId, event.subgroupId, event.episodeId]
      .compactMap { $0 })
    if let fields = event.fields, !fields.isEmpty {
      let fieldsText = fields
        .sorted { $0.key < $1.key }
        .map { "\($0.key):\($0.value.displayText)" }
        .joined(separator: " ")
      parts.append(fieldsText)
    }
    return parts.joined(separator: " ").lowercased()
  }
}
