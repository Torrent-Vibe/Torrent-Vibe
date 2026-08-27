import Foundation

enum TorrentFilter: String, CaseIterable, Identifiable, Sendable {
  case all
  case downloading
  case seeding
  case completed
  case paused
  case error

  var id: String { rawValue }

  var title: String {
    switch self {
    case .all: String(localized: "全部")
    case .downloading: String(localized: "下载中")
    case .seeding: String(localized: "做种")
    case .completed: String(localized: "已完成")
    case .paused: String(localized: "已暂停")
    case .error: String(localized: "错误")
    }
  }

  var systemImage: String {
    switch self {
    case .all: "tray.full"
    case .downloading: "arrow.down.circle"
    case .seeding: "arrow.up.circle"
    case .completed: "checkmark.circle"
    case .paused: "pause.circle"
    case .error: "exclamationmark.circle"
    }
  }

  func includes(_ torrent: TorrentSummary) -> Bool {
    switch self {
    case .all: true
    case .downloading: torrent.statusGroup == .downloading
    case .seeding: torrent.statusGroup == .seeding
    case .completed: torrent.statusGroup == .completed
    case .paused: torrent.statusGroup == .paused
    case .error: torrent.statusGroup == .error
    }
  }
}

enum TorrentStatusGroup: String, Sendable {
  case downloading
  case seeding
  case completed
  case paused
  case error
  case other

  init(qbittorrentState state: String) {
    switch state.lowercased() {
    case "downloading", "stalleddl", "queueddl", "forceddl", "metadl", "forcedmetadl":
      self = .downloading
    case "uploading", "stalledup", "queuedup", "forcedup":
      self = .seeding
    case "checkingup", "pausedup", "stoppedup":
      self = .completed
    case "pauseddl", "stoppeddl":
      self = .paused
    case "error", "missingfiles":
      self = .error
    default:
      self = .other
    }
  }
}

extension TorrentStatus {
  var defaultStatusGroup: TorrentStatusGroup {
    switch self {
    case .downloading: .downloading
    case .seeding: .seeding
    case .paused: .paused
    case .completed: .completed
    case .error: .error
    case .queued: .other
    }
  }
}

enum TorrentFilterCounting {
  static func counts(for torrents: [TorrentSummary]) -> [TorrentFilter: Int] {
    var counts = [TorrentFilter: Int]()
    for filter in TorrentFilter.allCases {
      counts[filter] = 0
    }
    for torrent in torrents {
      for filter in TorrentFilter.allCases where filter.includes(torrent) {
        counts[filter, default: 0] += 1
      }
    }
    return counts
  }
}
