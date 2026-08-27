import Foundation

enum MikanEpisodeBadgeTone: Equatable, Sendable {
  case accent
  case destructive
  case muted
  case neutral
  case success
  case warning
}

struct MikanEpisodeBadge: Equatable, Sendable {
  let icon: String
  let title: String
  let tone: MikanEpisodeBadgeTone
}

enum MikanEpisodeBadgeModel {
  static func badge(for state: HelperEpisodeState) -> MikanEpisodeBadge {
    MikanEpisodeBadge(icon: icon(for: state), title: state.title, tone: tone(for: state))
  }

  private static func tone(for state: HelperEpisodeState) -> MikanEpisodeBadgeTone {
    switch state {
    case .done: .success
    case .downloading, .renaming: .accent
    case .pending, .added: .neutral
    case .failed: .destructive
    case .needsManual: .warning
    case .skipped: .muted
    }
  }

  private static func icon(for state: HelperEpisodeState) -> String {
    switch state {
    case .pending, .added: "clock"
    case .downloading: "arrow.down.circle"
    case .renaming: "pencil.circle"
    case .done: "checkmark.circle"
    case .failed: "xmark.circle"
    case .needsManual: "exclamationmark.triangle"
    case .skipped: "minus.circle"
    }
  }
}

struct MikanEpisodeTorrentIndex {
  private let torrentsByLowercasedHash: [String: TorrentSummary]

  init(torrents: [TorrentSummary]) {
    var index: [String: TorrentSummary] = [:]
    for torrent in torrents {
      index[torrent.id.lowercased()] = torrent
    }
    torrentsByLowercasedHash = index
  }

  func torrent(forInfohash infohash: String?) -> TorrentSummary? {
    guard let infohash else { return nil }
    return torrentsByLowercasedHash[infohash.lowercased()]
  }
}

enum MikanEpisodeLiveProgress {
  static func percentText(for torrent: TorrentSummary) -> String {
    String(localized: "\(Int((torrent.progress * 100).rounded()))%")
  }
}

enum MikanEpisodeRemedy: Equatable, Sendable {
  case downloadAnyway
  case importEpisode
  case retry
}

struct MikanEpisodeRowModel: Equatable, Sendable {
  let badge: MikanEpisodeBadge?
  let liveProgressText: String?
  let remedy: MikanEpisodeRemedy?
}

enum MikanEpisodeRowModelBuilder {
  static func build(
    state: HelperEpisodeState?,
    infohash: String?,
    subscribed: Bool,
    torrentIndex: MikanEpisodeTorrentIndex
  ) -> MikanEpisodeRowModel {
    let liveProgressText: String?
    if state == .downloading, let torrent = torrentIndex.torrent(forInfohash: infohash) {
      liveProgressText = MikanEpisodeLiveProgress.percentText(for: torrent)
    } else {
      liveProgressText = nil
    }

    let remedy: MikanEpisodeRemedy?
    if !subscribed {
      remedy = .importEpisode
    } else if state == .failed {
      remedy = .retry
    } else if state == .skipped || state == .needsManual {
      remedy = .downloadAnyway
    } else {
      remedy = nil
    }

    return MikanEpisodeRowModel(
      badge: state.map(MikanEpisodeBadgeModel.badge(for:)),
      liveProgressText: liveProgressText,
      remedy: remedy
    )
  }
}
