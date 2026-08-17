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
  let shareRatio: Double
  let savePath: String
  let category: String?
  let tags: [String]
  let addedAt: Date?
  let completedAt: Date?

  init(
    id: String,
    name: String,
    progress: Double,
    size: String,
    downloadSpeed: String,
    uploadSpeed: String,
    eta: String,
    status: TorrentStatus,
    shareRatio: Double = 0,
    savePath: String = "—",
    category: String? = nil,
    tags: [String] = [],
    addedAt: Date? = nil,
    completedAt: Date? = nil
  ) {
    self.id = id
    self.name = name
    self.progress = progress
    self.size = size
    self.downloadSpeed = downloadSpeed
    self.uploadSpeed = uploadSpeed
    self.eta = eta
    self.status = status
    self.shareRatio = shareRatio
    self.savePath = savePath
    self.category = category
    self.tags = tags
    self.addedAt = addedAt
    self.completedAt = completedAt
  }

  var isPaused: Bool { status == .paused }

  var statusTitle: String {
    switch status {
    case .downloading: "下载中"
    case .seeding: "做种中"
    case .paused: "已暂停"
    case .completed: "已完成"
    case .queued: "排队中"
    case .error: "错误"
    }
  }

  func updating(
    status: TorrentStatus,
    downloadSpeed: String? = nil,
    uploadSpeed: String? = nil,
    eta: String? = nil
  ) -> TorrentSummary {
    TorrentSummary(
      id: id,
      name: name,
      progress: progress,
      size: size,
      downloadSpeed: downloadSpeed ?? self.downloadSpeed,
      uploadSpeed: uploadSpeed ?? self.uploadSpeed,
      eta: eta ?? self.eta,
      status: status,
      shareRatio: shareRatio,
      savePath: savePath,
      category: category,
      tags: tags,
      addedAt: addedAt,
      completedAt: completedAt
    )
  }
}

enum TorrentStatus: String, Hashable, Sendable {
  case downloading
  case seeding
  case paused
  case completed
  case queued
  case error
}
