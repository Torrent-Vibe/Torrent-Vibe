import Foundation

struct TorrentSnapshot: Sendable {
  let torrents: [TorrentSummary]
  let totalDownloadSpeed: String
  let totalUploadSpeed: String
  let totalDownloadBytesPerSecond: Int64
  let totalUploadBytesPerSecond: Int64
  let serverVersion: String?
}

enum TorrentAddSource: Equatable, Sendable {
  case file(name: String, data: Data)
  case url(String)
}

struct TorrentAddRequest: Equatable, Sendable {
  let source: TorrentAddSource
  let savePath: String?
  let category: String?
  let tags: [String]
  let downloadLimit: Int64?
  let uploadLimit: Int64?

  init(
    source: TorrentAddSource,
    savePath: String? = nil,
    category: String? = nil,
    tags: [String] = [],
    downloadLimit: Int64? = nil,
    uploadLimit: Int64? = nil
  ) {
    self.source = source
    self.savePath = savePath
    self.category = category
    self.tags = tags
    self.downloadLimit = downloadLimit
    self.uploadLimit = uploadLimit
  }
}

struct TorrentManagementRequest: Equatable, Sendable {
  let category: String?
  let tags: [String]
  let downloadLimit: Int64
  let uploadLimit: Int64
}

protocol TorrentRepository: Sendable {
  func addTorrent(_ request: TorrentAddRequest, to server: ServerConfiguration) async throws
  func deleteTorrents(
    ids: [String],
    deleteFiles: Bool,
    on server: ServerConfiguration
  ) async throws
  func setPaused(
    _ paused: Bool,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws
  func toggleDownloadStrategy(
    _ strategy: TorrentDownloadStrategy,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws
  func updateTorrents(
    ids: [String],
    request: TorrentManagementRequest,
    on server: ServerConfiguration
  ) async throws
  func files(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentFileSummary]
  func trackers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentTrackerSummary]
  func peers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentPeerSummary]
  func snapshot(for server: ServerConfiguration) async throws -> TorrentSnapshot
}

actor QBittorrentTorrentRepository: TorrentRepository {
  private let credentialStore: any ServerCredentialStore
  private let sessionFactory: @Sendable () -> URLSession

  init(
    credentialStore: any ServerCredentialStore,
    sessionFactory: @escaping @Sendable () -> URLSession = {
      let configuration = URLSessionConfiguration.ephemeral
      configuration.httpCookieAcceptPolicy = .always
      configuration.httpShouldSetCookies = true
      configuration.timeoutIntervalForRequest = 10
      configuration.timeoutIntervalForResource = 20
      return URLSession(configuration: configuration)
    }
  ) {
    self.credentialStore = credentialStore
    self.sessionFactory = sessionFactory
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
    var fields: [(String, String)] = []
    var file: MultipartFile?
    switch torrent.source {
    case .url(let source):
      fields.append(("urls", source))
    case .file(let name, let data):
      file = MultipartFile(
        fieldName: "torrents",
        fileName: name,
        contentType: "application/x-bittorrent",
        data: data
      )
    }
    if let savePath = torrent.savePath {
      fields.append(("savepath", savePath))
    }
    if let category = torrent.category {
      fields.append(("category", category))
    }
    if !torrent.tags.isEmpty {
      fields.append(("tags", torrent.tags.joined(separator: ",")))
    }
    if let downloadLimit = torrent.downloadLimit {
      fields.append(("dlLimit", String(downloadLimit)))
    }
    if let uploadLimit = torrent.uploadLimit {
      fields.append(("upLimit", String(uploadLimit)))
    }
    request.httpBody = Self.multipartBody(fields: fields, file: file, boundary: boundary)

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

  func deleteTorrents(
    ids: [String],
    deleteFiles: Bool,
    on server: ServerConfiguration
  ) async throws {
    try validateTorrentIDs(ids)
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    try await postForm(
      session: session,
      server: server,
      path: "/torrents/delete",
      items: [
        URLQueryItem(name: "hashes", value: ids.joined(separator: "|")),
        URLQueryItem(name: "deleteFiles", value: String(deleteFiles)),
      ]
    )
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
      totalDownloadBytesPerSecond: transfer.downloadSpeed,
      totalUploadBytesPerSecond: transfer.uploadSpeed,
      serverVersion: version?.trimmingCharacters(in: .whitespacesAndNewlines)
    )
  }

  func files(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentFileSummary]
  {
    try validateTorrentIDs([torrentID])
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    let data = try await get(
      session: session,
      server: server,
      path: "/torrents/files",
      queryItems: [URLQueryItem(name: "hash", value: torrentID)]
    )
    return try JSONDecoder().decode([QBittorrentFile].self, from: data).map(\.summary)
  }

  func trackers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentTrackerSummary]
  {
    try validateTorrentIDs([torrentID])
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    let data = try await get(
      session: session,
      server: server,
      path: "/torrents/trackers",
      queryItems: [URLQueryItem(name: "hash", value: torrentID)]
    )
    return try JSONDecoder().decode([QBittorrentTracker].self, from: data)
      .enumerated()
      .map { index, tracker in tracker.summary(index: index) }
  }

  func peers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentPeerSummary]
  {
    try validateTorrentIDs([torrentID])
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    let data = try await get(
      session: session,
      server: server,
      path: "/sync/torrentPeers",
      queryItems: [
        URLQueryItem(name: "hash", value: torrentID),
        URLQueryItem(name: "rid", value: "0"),
      ]
    )
    let response = try JSONDecoder().decode(QBittorrentPeerResponse.self, from: data)
    return response.peers.map { endpoint, peer in peer.summary(id: endpoint) }
      .sorted { $0.endpoint.localizedStandardCompare($1.endpoint) == .orderedAscending }
  }

  func setPaused(
    _ paused: Bool,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws {
    try validateTorrentIDs(torrentIDs)
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    try await postForm(
      session: session,
      server: server,
      path: paused ? "/torrents/stop" : "/torrents/start",
      items: [URLQueryItem(name: "hashes", value: torrentIDs.joined(separator: "|"))]
    )
  }

  func toggleDownloadStrategy(
    _ strategy: TorrentDownloadStrategy,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws {
    try validateTorrentIDs(torrentIDs)
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }
    let path =
      switch strategy {
      case .sequential: "/torrents/toggleSequentialDownload"
      case .firstLastPiecePriority: "/torrents/toggleFirstLastPiecePrio"
      }
    try await postForm(
      session: session,
      server: server,
      path: path,
      items: [URLQueryItem(name: "hashes", value: torrentIDs.joined(separator: "|"))]
    )
  }

  func updateTorrents(
    ids: [String],
    request: TorrentManagementRequest,
    on server: ServerConfiguration
  ) async throws {
    try validateTorrentIDs(ids)
    let session = try await authenticatedSession(for: server)
    defer { session.invalidateAndCancel() }

    let hashes = ids.joined(separator: "|")
    try await postForm(
      session: session,
      server: server,
      path: "/torrents/setCategory",
      items: [
        URLQueryItem(name: "hashes", value: hashes),
        URLQueryItem(name: "category", value: request.category ?? ""),
      ]
    )
    try await postForm(
      session: session,
      server: server,
      path: "/torrents/removeTags",
      items: [
        URLQueryItem(name: "hashes", value: hashes),
        URLQueryItem(name: "tags", value: ""),
      ]
    )
    if !request.tags.isEmpty {
      try await postForm(
        session: session,
        server: server,
        path: "/torrents/addTags",
        items: [
          URLQueryItem(name: "hashes", value: hashes),
          URLQueryItem(name: "tags", value: request.tags.joined(separator: ",")),
        ]
      )
    }
    try await postForm(
      session: session,
      server: server,
      path: "/torrents/setDownloadLimit",
      items: [
        URLQueryItem(name: "hashes", value: hashes),
        URLQueryItem(name: "limit", value: String(request.downloadLimit)),
      ]
    )
    try await postForm(
      session: session,
      server: server,
      path: "/torrents/setUploadLimit",
      items: [
        URLQueryItem(name: "hashes", value: hashes),
        URLQueryItem(name: "limit", value: String(request.uploadLimit)),
      ]
    )
  }

  private func authenticatedSession(for server: ServerConfiguration) async throws -> URLSession {
    guard let password = try credentialStore.password(for: server.id), !password.isEmpty else {
      throw QBittorrentRepositoryError.missingPassword
    }

    let session = sessionFactory()
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
    path: String,
    queryItems: [URLQueryItem] = []
  ) async throws -> Data {
    var components = URLComponents(
      url: try endpoint(server: server, path: path),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = queryItems.isEmpty ? nil : queryItems
    guard let url = components?.url else {
      throw QBittorrentRepositoryError.invalidServerURL
    }
    let request = URLRequest(url: url)
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

  private func postForm(
    session: URLSession,
    server: ServerConfiguration,
    path: String,
    items: [URLQueryItem]
  ) async throws {
    var request = URLRequest(url: try endpoint(server: server, path: path))
    request.httpMethod = "POST"
    request.setValue(
      "application/x-www-form-urlencoded",
      forHTTPHeaderField: "Content-Type"
    )
    request.httpBody = Self.formData(items)

    let (_, response) = try await session.data(for: request)
    let httpResponse = try Self.validatedHTTPResponse(response)
    if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
      throw QBittorrentRepositoryError.authenticationFailed
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw QBittorrentRepositoryError.httpStatus(httpResponse.statusCode)
    }
  }

  private func validateTorrentIDs(_ ids: [String]) throws {
    guard !ids.isEmpty, ids.allSatisfy({ !$0.isEmpty }) else {
      throw QBittorrentRepositoryError.missingTorrentSelection
    }
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

  private static func multipartBody(
    fields: [(String, String)],
    file: MultipartFile?,
    boundary: String
  ) -> Data {
    var body = Data()
    for (name, value) in fields {
      body.append(Data("--\(boundary)\r\n".utf8))
      body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
      body.append(Data(value.utf8))
      body.append(Data("\r\n".utf8))
    }
    if let file {
      let fileName = file.fileName
        .replacingOccurrences(of: "\"", with: "_")
        .replacingOccurrences(of: "\r", with: "_")
        .replacingOccurrences(of: "\n", with: "_")
      body.append(Data("--\(boundary)\r\n".utf8))
      body.append(
        Data(
          "Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(fileName)\"\r\n"
            .utf8
        )
      )
      body.append(Data("Content-Type: \(file.contentType)\r\n\r\n".utf8))
      body.append(file.data)
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

private struct MultipartFile: Sendable {
  let fieldName: String
  let fileName: String
  let contentType: String
  let data: Data
}

actor DemoTorrentRepository: TorrentRepository {
  private let reportsIdleTransfers: Bool
  private var nextImportedID = 1
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
      addedAt: Date(timeIntervalSince1970: 1_786_377_600),
      isSequentialDownloadEnabled: true
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
    TorrentSummary(
      id: "demo-dune",
      name: "Dune: Part Two · 2160p HDR",
      progress: 0.58,
      size: "31.4 GB",
      downloadSpeed: "11.7 MB/s",
      uploadSpeed: "620 KB/s",
      eta: "19 分钟",
      status: .downloading,
      shareRatio: 0.18,
      savePath: "/Media/Movies/Dune Part Two",
      category: "movies",
      tags: ["4K", "HDR"]
    ),
    TorrentSummary(
      id: "demo-cosmos",
      name: "Cosmos: A Spacetime Odyssey · Complete",
      progress: 1,
      size: "48.2 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "2.3 MB/s",
      eta: "已完成",
      status: .seeding,
      shareRatio: 1.76,
      savePath: "/Media/Documentary/Cosmos",
      category: "documentary",
      tags: ["1080P", "TV"]
    ),
    TorrentSummary(
      id: "demo-photos",
      name: "Family Photo Archive · 2018–2025",
      progress: 0.81,
      size: "86.7 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "已暂停",
      status: .paused,
      savePath: "/Archive/Photos",
      category: "archive"
    ),
    TorrentSummary(
      id: "demo-blender",
      name: "Blender Studio Open Movies Collection",
      progress: 1,
      size: "14.9 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "已完成",
      status: .completed,
      shareRatio: 1.04,
      savePath: "/Media/Open Movies",
      category: "movies",
      tags: ["Creative Commons"]
    ),
    TorrentSummary(
      id: "demo-swift",
      name: "Swift 6.3 Development Snapshot",
      progress: 0.43,
      size: "2.8 GB",
      downloadSpeed: "6.2 MB/s",
      uploadSpeed: "84 KB/s",
      eta: "4 分钟",
      status: .downloading,
      savePath: "/Downloads/Toolchains",
      category: "software",
      tags: ["Swift"]
    ),
    TorrentSummary(
      id: "demo-debian",
      name: "Debian 13.1.0 arm64 netinst",
      progress: 1,
      size: "743 MB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "1.1 MB/s",
      eta: "已完成",
      status: .seeding,
      shareRatio: 5.62,
      savePath: "/Downloads/ISO",
      category: "software",
      tags: ["Linux"]
    ),
    TorrentSummary(
      id: "demo-course",
      name: "Distributed Systems Course Materials",
      progress: 0,
      size: "9.4 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "排队中",
      status: .queued,
      savePath: "/Media/Courses",
      category: "education"
    ),
    TorrentSummary(
      id: "demo-backup",
      name: "MacBook Pro Incremental Backup",
      progress: 0.47,
      size: "112.6 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "连接错误",
      status: .error,
      savePath: "/Archive/Backups",
      category: "archive"
    ),
    TorrentSummary(
      id: "demo-planet-earth",
      name: "Planet Earth III · Complete Series",
      progress: 1,
      size: "27.3 GB",
      downloadSpeed: "0 KB/s",
      uploadSpeed: "0 KB/s",
      eta: "已完成",
      status: .completed,
      shareRatio: 0.98,
      savePath: "/Media/Documentary/Planet Earth III",
      category: "documentary",
      tags: ["4K", "TV"]
    ),
  ]

  init(reportsIdleTransfers: Bool = false) {
    self.reportsIdleTransfers = reportsIdleTransfers
  }

  func addTorrent(_ request: TorrentAddRequest, to server: ServerConfiguration) async throws {
    try await Task.sleep(for: .milliseconds(450))
    let name: String
    switch request.source {
    case .file(let fileName, _):
      name = (fileName as NSString).deletingPathExtension
    case .url(let source):
      name =
        URL(string: source)?.lastPathComponent.removingPercentEncoding
        .flatMap { $0.isEmpty ? nil : $0 } ?? "新建 Torrent"
    }
    torrents.insert(
      TorrentSummary(
        id: "demo-import-\(nextImportedID)",
        name: name,
        progress: 0,
        size: "—",
        downloadSpeed: "0 KB/s",
        uploadSpeed: "0 KB/s",
        eta: "排队中",
        status: .queued,
        savePath: request.savePath ?? "/Downloads",
        category: request.category,
        tags: request.tags,
        addedAt: .now,
        downloadLimit: request.downloadLimit ?? 0,
        uploadLimit: request.uploadLimit ?? 0
      ),
      at: 0
    )
    nextImportedID += 1
  }

  func deleteTorrents(
    ids: [String],
    deleteFiles: Bool,
    on server: ServerConfiguration
  ) async throws {
    try await Task.sleep(for: .milliseconds(300))
    let selected = Set(ids)
    torrents.removeAll { selected.contains($0.id) }
  }

  func setPaused(
    _ paused: Bool,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws {
    try await Task.sleep(for: .milliseconds(300))
    let selected = Set(torrentIDs)
    guard torrents.contains(where: { selected.contains($0.id) }) else {
      throw QBittorrentRepositoryError.missingTorrentSelection
    }
    for index in torrents.indices where selected.contains(torrents[index].id) {
      let torrent = torrents[index]
      let resumedStatus: TorrentStatus = torrent.progress >= 1 ? .seeding : .downloading
      torrents[index] = torrent.updating(
        status: paused ? .paused : resumedStatus,
        downloadSpeed: paused
          ? "0 KB/s" : (resumedStatus == .downloading ? "18.4 MB/s" : "0 KB/s"),
        uploadSpeed: paused
          ? "0 KB/s" : (resumedStatus == .seeding ? "4.7 MB/s" : "1.2 MB/s"),
        eta: paused ? "已暂停" : (resumedStatus == .seeding ? "已完成" : "8 分钟")
      )
    }
  }

  func toggleDownloadStrategy(
    _ strategy: TorrentDownloadStrategy,
    torrentIDs: [String],
    on server: ServerConfiguration
  ) async throws {
    try await Task.sleep(for: .milliseconds(300))
    let selected = Set(torrentIDs)
    guard torrents.contains(where: { selected.contains($0.id) }) else {
      throw QBittorrentRepositoryError.missingTorrentSelection
    }
    for index in torrents.indices where selected.contains(torrents[index].id) {
      let torrent = torrents[index]
      let enabled =
        switch strategy {
        case .sequential: !torrent.isSequentialDownloadEnabled
        case .firstLastPiecePriority: !torrent.isFirstLastPiecePriorityEnabled
        }
      torrents[index] = torrent.updatingDownloadStrategy(strategy, enabled: enabled)
    }
  }

  func updateTorrents(
    ids: [String],
    request: TorrentManagementRequest,
    on server: ServerConfiguration
  ) async throws {
    try await Task.sleep(for: .milliseconds(300))
    let selected = Set(ids)
    guard torrents.contains(where: { selected.contains($0.id) }) else {
      throw QBittorrentRepositoryError.missingTorrentSelection
    }
    for index in torrents.indices where selected.contains(torrents[index].id) {
      torrents[index] = torrents[index].updatingManagement(
        category: request.category,
        tags: request.tags,
        downloadLimit: request.downloadLimit,
        uploadLimit: request.uploadLimit
      )
    }
  }

  func files(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentFileSummary]
  {
    try requireTorrent(torrentID)
    try await Task.sleep(for: .milliseconds(180))
    return [
      TorrentFileSummary(
        id: 0,
        name: "The Blue Planet II/Blue.Planet.II.S01E01.2160p.mkv",
        size: 18_962_710_528,
        progress: 0.72,
        priority: 1
      ),
      TorrentFileSummary(
        id: 1,
        name: "The Blue Planet II/Subtitles/zh-Hans.ass",
        size: 194_560,
        progress: 1,
        priority: 7
      ),
      TorrentFileSummary(
        id: 2,
        name: "The Blue Planet II/Behind the Scenes.mp4",
        size: 6_591_873_024,
        progress: 0.31,
        priority: 6
      ),
    ]
  }

  func trackers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentTrackerSummary]
  {
    try requireTorrent(torrentID)
    try await Task.sleep(for: .milliseconds(180))
    return [
      TorrentTrackerSummary(
        id: "0|https://tracker.example.test/announce",
        url: "https://tracker.example.test/announce",
        status: 2,
        tier: 0,
        message: "Announce succeeded",
        peerCount: 48,
        seedCount: 31,
        leechCount: 17,
        downloadedCount: 204
      ),
      TorrentTrackerSummary(
        id: "1|udp://backup.example.test:6969/announce",
        url: "udp://backup.example.test:6969/announce",
        status: 1,
        tier: 1,
        message: "Waiting for announce",
        peerCount: 0,
        seedCount: 0,
        leechCount: 0,
        downloadedCount: 0
      ),
    ]
  }

  func peers(for torrentID: String, on server: ServerConfiguration) async throws
    -> [TorrentPeerSummary]
  {
    try requireTorrent(torrentID)
    try await Task.sleep(for: .milliseconds(180))
    return [
      TorrentPeerSummary(
        id: "192.0.2.18:51413",
        ip: "192.0.2.18",
        port: 51_413,
        client: "Transmission 4.1",
        progress: 1,
        downloadSpeed: 0,
        uploadSpeed: 2_621_440,
        connection: "µTP",
        flags: "U E",
        flagsDescription: "上传中、加密连接",
        country: "测试网络"
      ),
      TorrentPeerSummary(
        id: "198.51.100.42:6881",
        ip: "198.51.100.42",
        port: 6_881,
        client: "qBittorrent 5.1",
        progress: 0.84,
        downloadSpeed: 6_291_456,
        uploadSpeed: 458_752,
        connection: "BT",
        flags: "D U E",
        flagsDescription: "下载中、上传中、加密连接",
        country: "测试网络"
      ),
      TorrentPeerSummary(
        id: "[2001:db8::23]:51413",
        ip: "2001:db8::23",
        port: 51_413,
        client: "libtorrent 2.0",
        progress: 0.53,
        downloadSpeed: 1_048_576,
        uploadSpeed: 0,
        connection: "µTP",
        flags: "D",
        flagsDescription: "下载中",
        country: "测试网络"
      ),
    ]
  }

  func snapshot(for server: ServerConfiguration) async throws -> TorrentSnapshot {
    let snapshotTorrents = reportsIdleTransfers
      ? torrents.map { torrent in
        switch torrent.status {
        case .downloading:
          torrent.updating(
            status: .paused,
            downloadSpeed: "0 KB/s",
            uploadSpeed: "0 KB/s",
            eta: "已暂停"
          )
        case .seeding:
          torrent.updating(
            status: .completed,
            downloadSpeed: "0 KB/s",
            uploadSpeed: "0 KB/s",
            eta: "已完成"
          )
        default:
          torrent.updating(
            status: torrent.status,
            downloadSpeed: "0 KB/s",
            uploadSpeed: "0 KB/s"
          )
        }
      }
      : torrents

    return TorrentSnapshot(
      torrents: snapshotTorrents,
      totalDownloadSpeed: reportsIdleTransfers ? "0 KB/s" : "18.4 MB/s",
      totalUploadSpeed: reportsIdleTransfers ? "0 KB/s" : "5.9 MB/s",
      totalDownloadBytesPerSecond: reportsIdleTransfers ? 0 : 19_293_798,
      totalUploadBytesPerSecond: reportsIdleTransfers ? 0 : 6_186_598,
      serverVersion: "v5.1.2"
    )
  }

  private func requireTorrent(_ torrentID: String) throws {
    guard torrents.contains(where: { $0.id == torrentID }) else {
      throw QBittorrentRepositoryError.missingTorrentSelection
    }
  }
}

private struct QBittorrentFile: Decodable {
  let index: Int
  let name: String
  let size: Int64
  let progress: Double
  let priority: Int

  var summary: TorrentFileSummary {
    TorrentFileSummary(
      id: index,
      name: name,
      size: size,
      progress: progress,
      priority: priority
    )
  }
}

private struct QBittorrentTracker: Decodable {
  let url: String
  let status: Int
  let tier: Int
  let message: String?
  let peerCount: Int?
  let seedCount: Int?
  let leechCount: Int?
  let downloadedCount: Int?

  enum CodingKeys: String, CodingKey {
    case url
    case status
    case tier
    case message = "msg"
    case peerCount = "num_peers"
    case seedCount = "num_seeds"
    case leechCount = "num_leeches"
    case downloadedCount = "num_downloaded"
  }

  func summary(index: Int) -> TorrentTrackerSummary {
    TorrentTrackerSummary(
      id: "\(index)|\(url)",
      url: url,
      status: status,
      tier: tier,
      message: message.flatMap { $0.isEmpty ? nil : $0 },
      peerCount: peerCount ?? 0,
      seedCount: seedCount ?? 0,
      leechCount: leechCount ?? 0,
      downloadedCount: downloadedCount ?? 0
    )
  }
}

private struct QBittorrentPeerResponse: Decodable {
  let peers: [String: QBittorrentPeer]
}

private struct QBittorrentPeer: Decodable {
  let ip: String?
  let port: Int?
  let client: String?
  let progress: Double?
  let downloadSpeed: Int64?
  let uploadSpeed: Int64?
  let connection: String?
  let flags: String?
  let flagsDescription: String?
  let country: String?

  enum CodingKeys: String, CodingKey {
    case ip
    case port
    case client
    case progress
    case downloadSpeed = "dl_speed"
    case uploadSpeed = "up_speed"
    case connection
    case flags
    case flagsDescription = "flags_desc"
    case country
  }

  func summary(id: String) -> TorrentPeerSummary {
    TorrentPeerSummary(
      id: id,
      ip: ip ?? id,
      port: port ?? 0,
      client: client.flatMap { $0.isEmpty ? nil : $0 } ?? "未知客户端",
      progress: progress ?? 0,
      downloadSpeed: downloadSpeed ?? 0,
      uploadSpeed: uploadSpeed ?? 0,
      connection: connection.flatMap { $0.isEmpty ? nil : $0 },
      flags: flags.flatMap { $0.isEmpty ? nil : $0 },
      flagsDescription: flagsDescription.flatMap { $0.isEmpty ? nil : $0 },
      country: country.flatMap { $0.isEmpty ? nil : $0 }
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
  let downloadLimit: Int64?
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
  let uploadLimit: Int64?
  let uploadSpeed: Int64
  let isSequentialDownloadEnabled: Bool?
  let isFirstLastPiecePriorityEnabled: Bool?

  enum CodingKeys: String, CodingKey {
    case addedOn = "added_on"
    case category
    case completionOn = "completion_on"
    case downloadLimit = "dl_limit"
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
    case uploadLimit = "up_limit"
    case uploadSpeed = "upspeed"
    case isSequentialDownloadEnabled = "seq_dl"
    case isFirstLastPiecePriorityEnabled = "f_l_piece_prio"
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
      completedAt: Self.date(from: torrent.completionOn),
      downloadLimit: torrent.downloadLimit ?? 0,
      uploadLimit: torrent.uploadLimit ?? 0,
      isSequentialDownloadEnabled: torrent.isSequentialDownloadEnabled ?? false,
      isFirstLastPiecePriorityEnabled: torrent.isFirstLastPiecePriorityEnabled ?? false
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
  case missingTorrentSelection
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
    case .missingTorrentSelection:
      "请至少选择一个 Torrent 任务。"
    }
  }
}
