import Foundation

struct TorrentFileSummary: Hashable, Identifiable, Sendable {
  let id: Int
  let name: String
  let size: Int64
  let progress: Double
  let priority: Int

  var displayName: String {
    (name as NSString).lastPathComponent
  }

  var directory: String? {
    let directory = (name as NSString).deletingLastPathComponent
    return directory == "." || directory.isEmpty ? nil : directory
  }

  var priorityTitle: String {
    switch priority {
    case 0: "不下载"
    case 6: "高"
    case 7: "最高"
    default: "普通"
    }
  }

  var formattedSize: String {
    Self.formatBytes(size)
  }

  private static func formatBytes(_ bytes: Int64) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    formatter.isAdaptive = true
    return formatter.string(fromByteCount: bytes)
  }
}

struct TorrentTrackerSummary: Hashable, Identifiable, Sendable {
  let id: String
  let url: String
  let status: Int
  let tier: Int
  let message: String?
  let peerCount: Int
  let seedCount: Int
  let leechCount: Int
  let downloadedCount: Int

  var statusTitle: String {
    switch status {
    case 0: "已禁用"
    case 1: "尚未联系"
    case 2: "工作中"
    case 3: "更新中"
    case 4: "不可用"
    default: "未知"
    }
  }
}

struct TorrentPeerSummary: Hashable, Identifiable, Sendable {
  let id: String
  let ip: String
  let port: Int
  let client: String
  let progress: Double
  let downloadSpeed: Int64
  let uploadSpeed: Int64
  let connection: String?
  let flags: String?
  let flagsDescription: String?
  let country: String?

  var endpoint: String {
    ip.contains(":") ? "[\(ip)]:\(port)" : "\(ip):\(port)"
  }

  var formattedDownloadSpeed: String {
    Self.formatSpeed(downloadSpeed)
  }

  var formattedUploadSpeed: String {
    Self.formatSpeed(uploadSpeed)
  }

  private static func formatSpeed(_ bytesPerSecond: Int64) -> String {
    guard bytesPerSecond > 0 else { return "0 KB/s" }
    let formatter = ByteCountFormatter()
    formatter.countStyle = .binary
    formatter.allowedUnits = [.useKB, .useMB, .useGB]
    formatter.isAdaptive = true
    return "\(formatter.string(fromByteCount: bytesPerSecond))/s"
  }
}
