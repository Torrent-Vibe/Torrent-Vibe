import Foundation

struct TorrentSummary: Hashable, Identifiable, Sendable {
  let id: String
  let name: String
  let progress: Double
  let size: String
  let downloadSpeed: String
  let uploadSpeed: String
  let eta: String
  let status: TorrentStatus
}

enum TorrentStatus: String, Hashable, Sendable {
  case downloading
  case seeding
  case paused
  case completed
  case queued
  case error
}

