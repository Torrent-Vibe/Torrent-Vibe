import ActivityKit
import Foundation

struct TorrentLiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let downloadSpeed: String
    let eta: String
    let isComplete: Bool
    let progress: Double
    let status: String
    let updatedAt: Date
  }

  let serverID: String
  let serverName: String
  let torrentID: String
  let torrentName: String
}
