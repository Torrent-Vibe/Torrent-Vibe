import Foundation

protocol TorrentRepository: Sendable {
  func torrents(for server: ServerConfiguration) async throws -> [TorrentSummary]
}

struct IntegrationPendingError: LocalizedError, Sendable {
  var errorDescription: String? {
    "qBittorrent 服务将在下一阶段接入。当前版本仅建立客户端结构。"
  }
}

struct IntegrationPlaceholderTorrentRepository: TorrentRepository {
  func torrents(for server: ServerConfiguration) async throws -> [TorrentSummary] {
    throw IntegrationPendingError()
  }
}

struct DemoTorrentRepository: TorrentRepository {
  func torrents(for server: ServerConfiguration) async throws -> [TorrentSummary] {
    [
      TorrentSummary(
        id: "demo-blue-planet",
        name: "The Blue Planet II · 2160p",
        progress: 0.72,
        size: "23.8 GB",
        downloadSpeed: "18.4 MB/s",
        uploadSpeed: "1.2 MB/s",
        eta: "8 分钟",
        status: .downloading
      ),
      TorrentSummary(
        id: "demo-frieren",
        name: "葬送的芙莉莲 · S01E28",
        progress: 1,
        size: "1.6 GB",
        downloadSpeed: "0 KB/s",
        uploadSpeed: "4.7 MB/s",
        eta: "已完成",
        status: .seeding
      ),
      TorrentSummary(
        id: "demo-ubuntu",
        name: "Ubuntu 26.04 Desktop",
        progress: 0.34,
        size: "6.1 GB",
        downloadSpeed: "0 KB/s",
        uploadSpeed: "0 KB/s",
        eta: "已暂停",
        status: .paused
      ),
    ]
  }
}

