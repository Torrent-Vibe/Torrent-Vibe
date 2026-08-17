import Foundation

struct TorrentSnapshot: Sendable {
  let torrents: [TorrentSummary]
  let totalDownloadSpeed: String
  let totalUploadSpeed: String
  let serverVersion: String?
}

struct TorrentAddRequest: Equatable, Sendable {
  let source: String
}

protocol TorrentRepository: Sendable {
  func addTorrent(_ request: TorrentAddRequest, to server: ServerConfiguration) async throws
  func setPaused(
    _ paused: Bool,
    torrentID: String,
    on server: ServerConfiguration
  ) async throws
  func snapshot(for server: ServerConfiguration) async throws -> TorrentSnapshot
}

actor QBittorrentTorrentRepository: TorrentRepository {
  private let credentialStore: any ServerCredentialStore

  init(credentialStore: any ServerCredentialStore) {
    self.credentialStore = credentialStore
  }

  func addTorrent(_ torrent: TorrentAddRequest, to server: ServerConfiguration) async throws {
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }

    var request = URLRequest(url: try endpoint(server: server, path: "/torrents/add"))
    request.httpMethod = "POST"

    let boundary = "TorrentVibe-\(UUID().uuidString)"
    request.setValue(
      "multipart/form-data; boundary=\(boundary)",
      forHTTPHeaderField: "Content-Type"
    )
    request.httpBody = Self.multipartBody(
      fields: ["urls": torrent.source],
      boundary: boundary
    )

    let (data, response) = try await session.data(for: request)
    let httpResponse = try Self.validatedHTTPResponse(response)
    if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
      throw QBittorrentRepositoryError.authenticationFailed
    }
    if httpResponse.statusCode == 415 {
      throw QBittorrentRepositoryError.invalidTorrent
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw QBittorrentRepositoryError.httpStatus(httpResponse.statusCode)
    }

    let responseText = String(data: data, encoding: .utf8)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if responseText?.lowercased() == "fails." || responseText?.lowercased() == "fails" {
      throw QBittorrentRepositoryError.addRejected
    }

    if let responseObject = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let successCount = responseObject["success_count"] as? Int,
      successCount == 0
    {
      throw QBittorrentRepositoryError.addRejected
    }
  }

  func snapshot(for server: ServerConfiguration) async throws -> TorrentSnapshot {
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }

    let torrentsData = try await get(
      session: session,
      server: server,
      path: "/torrents/info"
    )
    let transferData = try await get(
      session: session,
      server: server,
      path: "/transfer/info"
    )
    let versionData = try? await get(
      session: session,
      server: server,
      path: "/app/version"
    )

    let torrents = try JSONDecoder().decode([QBittorrentTorrent].self, from: torrentsData)
    let transfer = try JSONDecoder().decode(QBittorrentTransfer.self, from: transferData)
    let version = versionData.flatMap { String(data: $0, encoding: .utf8) }

    return TorrentSnapshot(
      torrents: torrents.map(TorrentSummary.init(qbittorrent:)),
      totalDownloadSpeed: Self.formatSpeed(transfer.downloadSpeed),
      totalUploadSpeed: Self.formatSpeed(transfer.uploadSpeed),
      serverVersion: version?.trimmingCharacters(in: .whitespacesAndNewlines)
    )
  }

  func setPaused(
    _ paused: Bool,
    torrentID: String,
    on server: ServerConfiguration
  ) async throws {
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }

    var request = URLRequest(
      url: try endpoint(
        server: server,
        path: paused ? "/torrents/stop" : "/torrents/start"
      )
    )
    request.httpMethod = "POST"
    request.setValue(
      "application/x-www-form-urlencoded",
      forHTTPHeaderField: "Content-Type"
    )
    request.httpBody = Self.formData([URLQueryItem(name: "hashes", value: torrentID)])

    let (_, response) = try await session.data(for: request)
    let httpResponse = try Self.validatedHTTPResponse(response)
    if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
      throw QBittorrentRepositoryError.authenticationFailed
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw QBittorrentRepositoryError.httpStatus(httpResponse.statusCode)
    }
  }

  private func authenticatedSession(for server: ServerConfiguration) async throws -> URLSession {
    guard let password = try credentialStore.password(for: server.id), !password.isEmpty else {
      throw QBittorrentRepositoryError.missingPassword
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .always
    configuration.httpShouldSetCookies = true
    configuration.timeoutIntervalForRequest = 10
    configuration.timeoutIntervalForResource = 20
    let session = URLSession(configuration: configuration)
    do {
      try await login(session: session, server: server, password: password)
    } catch {
      session.invalidateAndCancel()
      throw error
    }
    return session
  }

  private func login(
    session: URLSession,
    server: ServerConfiguration,
    password: String
  ) async throws {
    var request = URLRequest(url: try endpoint(server: server, path: "/auth/login"))
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.httpBody = Self.formData([
      URLQueryItem(name: "username", value: server.username),
      URLQueryItem(name: "password", value: password),
    ])

    let (data, response) = try await session.data(for: request)
    let httpResponse = try Self.validatedHTTPResponse(response)
    if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
      throw QBittorrentRepositoryError.authenticationFailed
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw QBittorrentRepositoryError.httpStatus(httpResponse.statusCode)
    }

    let responseText = String(data: data, encoding: .utf8)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard responseText == "Ok." || responseText == "Ok" else {
      throw QBittorrentRepositoryError.authenticationFailed
    }
  }

  private func get(
    session: URLSession,
    server: ServerConfiguration,
    path: String
  ) async throws -> Data {
    let request = URLRequest(url: try endpoint(server: server, path: path))
    let (data, response) = try await session.data(for: request)
    let httpResponse = try Self.validatedHTTPResponse(response)
    if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
      throw QBittorrentRepositoryError.authenticationFailed
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw QBittorrentRepositoryError.httpStatus(httpResponse.statusCode)
    }
    return data
  }

  private func endpoint(server: ServerConfiguration, path: String) throws -> URL {
    let base = server.baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard let url = URL(string: "\(base)/api/v2\(path)") else {
      throw QBittorrentRepositoryError.invalidServerURL
    }
    return url
  }

  private static func formData(_ items: [URLQueryItem]) -> Data {
    var components = URLComponents()
    components.queryItems = items
    return Data((components.percentEncodedQuery ?? "").utf8)
  }

  private static func multipartBody(fields: [String: String], boundary: String) -> Data {
    var body = Data()
    for (name, value) in fields {
      body.append(Data("--\(boundary)\r\n".utf8))
      body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
      body.append(Data(value.utf8))
      body.append(Data("\r\n".utf8))
    }
    body.append(Data("--\(boundary)--\r\n".utf8))
    return body
  }

  private static func validatedHTTPResponse(_ response: URLResponse) throws -> HTTPURLResponse {
    guard let response = response as? HTTPURLResponse else {
      throw QBittorrentRepositoryError.invalidResponse
    }
    return response
  }

  private static func formatSpeed(_ bytesPerSecond: Int64) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .binary
    formatter.allowedUnits = [.useKB, .useMB, .useGB]
    formatter.includesUnit = true
    formatter.isAdaptive = true
    return "\(formatter.string(fromByteCount: bytesPerSecond))/s"
  }
}

actor DemoTorrentRepository: TorrentRepository {
  private var torrents = [
    TorrentSummary(
      id: "demo-blue-planet",
      name: "The Blue Planet II · 2160p",
      progress: 0.72,
      size: "23.8 GB",
      downloadSpeed: "18.4 MB/s",
      uploadSpeed: "1.2 MB/s",
      eta: "8 分钟",
      status: .downloading,
      shareRatio: 0.42,
      savePath: "/Media/Documentary/The Blue Planet II",
      category: "documentary",
      tags: ["4K", "TV"],
      addedAt: Date(timeIntervalSince1970: 1_786_377_600)
    ),
    TorrentSummary(
      id: "demo-frieren",
      name: "葬送的芙莉莲 · S01E28",
      progress: 1,
      size: "1.6 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "4.7 MB/s",
      eta: "已完成",
      status: .seeding,
      shareRatio: 3.18,
      savePath: "/Media/Anime/Frieren",
      category: "anime",
      tags: ["1080P", "Season 1"],
      addedAt: Date(timeIntervalSince1970: 1_785_772_800),
      completedAt: Date(timeIntervalSince1970: 1_785_859_200)
    ),
    TorrentSummary(
      id: "demo-ubuntu",
      name: "Ubuntu 26.04 Desktop",
      progress: 0.34,
      size: "6.1 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "已暂停",
      status: .paused,
      shareRatio: 0,
      savePath: "/Downloads/ISO",
      category: "software",
      tags: ["Linux"],
      addedAt: Date(timeIntervalSince1970: 1_786_550_400)
    ),
  ]

  func addTorrent(_ request: TorrentAddRequest, to server: ServerConfiguration) async throws {
    try await Task.sleep(for: .milliseconds(450))
  }

  func setPaused(
    _ paused: Bool,
    torrentID: String,
    on server: ServerConfiguration
  ) async throws {
    try await Task.sleep(for: .milliseconds(300))
    guard let index = torrents.firstIndex(where: { $0.id == torrentID }) else {
      throw QBittorrentRepositoryError.invalidResponse
    }
    let torrent = torrents[index]
    let resumedStatus: TorrentStatus = torrent.progress >= 1 ? .seeding : .downloading
    torrents[index] = torrent.updating(
      status: paused ? .paused : resumedStatus,
      downloadSpeed: paused ? "0 KB/s" : (resumedStatus == .downloading ? "18.4 MB/s" : "0 KB/s"),
      uploadSpeed: paused ? "0 KB/s" : (resumedStatus == .seeding ? "4.7 MB/s" : "1.2 MB/s"),
      eta: paused ? "已暂停" : (resumedStatus == .seeding ? "已完成" : "8 分钟")
    )
  }

  func snapshot(for server: ServerConfiguration) async throws -> TorrentSnapshot {
    TorrentSnapshot(
      torrents: torrents,
      totalDownloadSpeed: "18.4 MB/s",
      totalUploadSpeed: "5.9 MB/s",
      serverVersion: "v5.1.2"
    )
  }
}

private struct QBittorrentTransfer: Decodable {
  let downloadSpeed: Int64
  let uploadSpeed: Int64

  enum CodingKeys: String, CodingKey {
    case downloadSpeed = "dl_info_speed"
    case uploadSpeed = "up_info_speed"
  }
}

private struct QBittorrentTorrent: Decodable {
  let addedOn: Int64?
  let category: String?
  let completionOn: Int64?
  let downloadSpeed: Int64
  let eta: Int64
  let hash: String
  let name: String
  let progress: Double
  let ratio: Double?
  let savePath: String?
  let size: Int64
  let state: String
  let tags: String?
  let totalSize: Int64?
  let uploadSpeed: Int64

  enum CodingKeys: String, CodingKey {
    case addedOn = "added_on"
    case category
    case completionOn = "completion_on"
    case downloadSpeed = "dlspeed"
    case eta
    case hash
    case name
    case progress
    case ratio
    case savePath = "save_path"
    case size
    case state
    case tags
    case totalSize = "total_size"
    case uploadSpeed = "upspeed"
  }
}

extension TorrentSummary {
  fileprivate init(qbittorrent torrent: QBittorrentTorrent) {
    self.init(
      id: torrent.hash,
      name: torrent.name,
      progress: torrent.progress,
      size: Self.formatBytes(torrent.totalSize ?? torrent.size),
      downloadSpeed: Self.formatSpeed(torrent.downloadSpeed),
      uploadSpeed: Self.formatSpeed(torrent.uploadSpeed),
      eta: Self.formatETA(torrent.eta),
      status: Self.status(for: torrent.state, progress: torrent.progress),
      shareRatio: torrent.ratio ?? 0,
      savePath: torrent.savePath ?? "—",
      category: torrent.category.flatMap { $0.isEmpty ? nil : $0 },
      tags: torrent.tags?
        .split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty } ?? [],
      addedAt: Self.date(from: torrent.addedOn),
      completedAt: Self.date(from: torrent.completionOn)
    )
  }

  private static func date(from timestamp: Int64?) -> Date? {
    guard let timestamp, timestamp > 0 else { return nil }
    return Date(timeIntervalSince1970: TimeInterval(timestamp))
  }

  private static func status(for state: String, progress: Double) -> TorrentStatus {
    switch state.lowercased() {
    case "downloading", "forceddl", "metadl", "forcedmetadl", "stalleddl":
      .downloading
    case "uploading", "forcedup", "stalledup":
      .seeding
    case "pauseddl", "pausedup", "stoppeddl", "stoppedup":
      .paused
    case "queuedup", "queueddl", "allocating", "checkingdl", "checkingup",
      "queuedforchecking", "checkingresumedata", "moving":
      .queued
    case "error", "missingfiles":
      .error
    default:
      progress >= 1 ? .completed : .queued
    }
  }

  private static func formatBytes(_ bytes: Int64) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    formatter.allowedUnits = [.useMB, .useGB, .useTB]
    formatter.isAdaptive = true
    return formatter.string(fromByteCount: bytes)
  }

  private static func formatSpeed(_ bytesPerSecond: Int64) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .binary
    formatter.allowedUnits = [.useKB, .useMB, .useGB]
    formatter.isAdaptive = true
    return "\(formatter.string(fromByteCount: bytesPerSecond))/s"
  }

  private static func formatETA(_ seconds: Int64) -> String {
    if seconds <= 0 { return "即将完成" }
    if seconds >= 8_640_000 { return "∞" }
    if seconds < 60 { return "\(seconds) 秒" }
    if seconds < 3_600 { return "\(seconds / 60) 分钟" }
    if seconds < 86_400 { return "\(seconds / 3_600) 小时" }
    return "\(seconds / 86_400) 天"
  }
}

enum QBittorrentRepositoryError: LocalizedError {
  case addRejected
  case authenticationFailed
  case httpStatus(Int)
  case invalidTorrent
  case invalidResponse
  case invalidServerURL
  case missingPassword

  var errorDescription: String? {
    switch self {
    case .addRejected:
      "qBittorrent 拒绝了此 Torrent，请检查来源是否仍然有效。"
    case .authenticationFailed:
      "qBittorrent 登录失败，请检查用户名和密码。"
    case .httpStatus(let status):
      "qBittorrent 返回 HTTP \(status)。"
    case .invalidResponse:
      "qBittorrent 返回了无效响应。"
    case .invalidTorrent:
      "qBittorrent 无法识别此 Torrent。"
    case .invalidServerURL:
      "qBittorrent 地址无效。"
    case .missingPassword:
      "Keychain 中没有此服务器的密码。"
    }
  }
}
