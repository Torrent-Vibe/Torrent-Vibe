import Foundation

enum MikanSubscriptionBarCheckState: Equatable, Sendable {
  case checked(Date)
  case never
}

enum MikanSubscriptionBarVariant: Equatable, Sendable {
  case healthy(
    serverLabel: String, ready: Int, total: Int, failed: Int,
    checkedAt: MikanSubscriptionBarCheckState)
  case checkFailing(serverLabel: String, checkError: String, consecutiveFailures: Int)
  case offline(serverLabel: String, checkedAt: Date?)
  case needsRepairing(serverLabel: String)
}

struct MikanSubscriptionBarTarget: Equatable, Sendable {
  let serverName: String
  let source: HelperSubscriptionSource
  let checkedAt: Date?
  let checkError: String?
  let consecutiveFailures: Int?
  let needsRepairing: Bool

  init(
    serverName: String,
    source: HelperSubscriptionSource,
    checkedAt: Date? = nil,
    checkError: String? = nil,
    consecutiveFailures: Int? = nil,
    needsRepairing: Bool = false
  ) {
    self.serverName = serverName
    self.source = source
    self.checkedAt = checkedAt
    self.checkError = checkError
    self.consecutiveFailures = consecutiveFailures
    self.needsRepairing = needsRepairing
  }
}

struct MikanSubscriptionBarProgress: Equatable, Sendable {
  let ready: Int
  let total: Int
  let failed: Int
}

struct MikanSubscriptionBarInput: Equatable, Sendable {
  let targets: [MikanSubscriptionBarTarget]
  let progress: MikanSubscriptionBarProgress
}

enum MikanSubscriptionBarModel {
  static func build(_ input: MikanSubscriptionBarInput) -> MikanSubscriptionBarVariant {
    let label = input.targets.map(\.serverName).joined(separator: "、")

    if input.targets.contains(where: \.needsRepairing) {
      return .needsRepairing(serverLabel: label)
    }

    if !input.targets.isEmpty, input.targets.allSatisfy({ $0.source == .cache }) {
      return .offline(serverLabel: label, checkedAt: input.targets.compactMap(\.checkedAt).max())
    }

    if let failing = worstFailingTarget(input.targets), let checkError = failing.checkError {
      return .checkFailing(
        serverLabel: label,
        checkError: checkError,
        consecutiveFailures: failing.consecutiveFailures ?? 1
      )
    }

    let checkedAt =
      input.targets.compactMap(\.checkedAt).max().map(MikanSubscriptionBarCheckState.checked)
      ?? .never
    return .healthy(
      serverLabel: label,
      ready: input.progress.ready,
      total: input.progress.total,
      failed: input.progress.failed,
      checkedAt: checkedAt
    )
  }

  private static func worstFailingTarget(
    _ targets: [MikanSubscriptionBarTarget]
  ) -> MikanSubscriptionBarTarget? {
    targets
      .filter { $0.checkError != nil }
      .max { ($0.consecutiveFailures ?? 1) < ($1.consecutiveFailures ?? 1) }
  }

  static func progress(from targets: [HelperSubscriptionTarget]) -> MikanSubscriptionBarProgress {
    var resolved: [String: HelperEpisodeState] = [:]
    for target in targets {
      for episode in target.episodes {
        if let current = resolved[episode.episodeId] {
          if episodeStateRank(episode.state) < episodeStateRank(current) {
            resolved[episode.episodeId] = episode.state
          }
        } else {
          resolved[episode.episodeId] = episode.state
        }
      }
    }

    var ready = 0
    var failed = 0
    for state in resolved.values {
      if state == .done { ready += 1 }
      if state == .failed || state == .needsManual { failed += 1 }
    }
    return MikanSubscriptionBarProgress(ready: ready, total: resolved.count, failed: failed)
  }

  private static func episodeStateRank(_ state: HelperEpisodeState) -> Int {
    switch state {
    case .failed: 0
    case .needsManual: 1
    case .pending: 2
    case .added: 3
    case .downloading: 4
    case .renaming: 5
    case .skipped: 6
    case .done: 7
    }
  }

  static func segments(for variant: MikanSubscriptionBarVariant, now: Date) -> [String] {
    switch variant {
    case .healthy(let serverLabel, let ready, let total, let failed, let checkedAt):
      var segments = [serverLabel, "\(ready)/\(total) 就绪"]
      if failed > 0 {
        segments.append("\(failed) 失败")
      }
      switch checkedAt {
      case .checked(let date):
        segments.append("\(relativeTimeFragment(from: date, now: now))检查")
      case .never:
        segments.append("从未检查")
      }
      return segments
    case .checkFailing(let serverLabel, _, let consecutiveFailures):
      return [serverLabel, "RSS 抓取失败 · 连续 \(consecutiveFailures) 次"]
    case .offline(let serverLabel, let checkedAt):
      guard let checkedAt else { return [serverLabel, "离线"] }
      return [serverLabel, "上次同步 \(relativeTimeFragment(from: checkedAt, now: now))"]
    case .needsRepairing(let serverLabel):
      return [serverLabel, "需要重新配对"]
    }
  }

  static func relativeTimeFragment(from date: Date, now: Date) -> String {
    let seconds = max(0, now.timeIntervalSince(date))
    if seconds < 60 { return "刚刚" }
    if seconds < 3600 { return "\(Int(seconds / 60)) 分钟前" }
    if seconds < 86400 { return "\(Int(seconds / 3600)) 小时前" }
    return "\(Int(seconds / 86400)) 天前"
  }
}
