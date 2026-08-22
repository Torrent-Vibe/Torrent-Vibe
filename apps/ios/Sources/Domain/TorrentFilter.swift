import Foundation

enum TorrentFilter: String, CaseIterable, Identifiable, Sendable {
  case all
  case completed
  case downloading
  case error
  case paused
  case seeding

  var id: String { rawValue }

  var title: String {
    switch self {
    case .all: "全部"
    case .downloading: "下载中"
    case .seeding: "做种"
    case .completed: "已完成"
    case .paused: "已暂停"
    case .error: "错误"
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
    case .completed: torrent.status == .completed
    case .downloading: torrent.status == .downloading
    case .error: torrent.status == .error
    case .paused: torrent.status == .paused
    case .seeding: torrent.status == .seeding
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
