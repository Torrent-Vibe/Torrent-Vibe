import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
  private(set) var servers: [ServerConfiguration]
  private(set) var activeServerID: UUID?
  private(set) var torrents: [TorrentSummary] = []
  private(set) var isRefreshing = false
  private(set) var lastUpdated: Date?
  private(set) var integrationNotice: String?

  let isDemoMode: Bool

  private let torrentRepository: any TorrentRepository
  private let defaults: UserDefaults
  private static let serversStorageKey = "torrentVibe.servers"
  private static let activeServerStorageKey = "torrentVibe.activeServer"

  init(
    launchArguments: [String] = ProcessInfo.processInfo.arguments,
    defaults: UserDefaults = .standard
  ) {
    let demoMode = launchArguments.contains("-ui-demo")
    isDemoMode = demoMode
    self.defaults = defaults
    torrentRepository = demoMode
      ? DemoTorrentRepository()
      : IntegrationPlaceholderTorrentRepository()

    if demoMode {
      let demoServer = ServerConfiguration(
        name: "家庭 NAS",
        baseURL: URL(string: "https://nas.example.test:8080")!,
        username: "demo",
        helperBaseURL: URL(string: "https://nas.example.test:17890")
      )
      servers = [demoServer]
      activeServerID = demoServer.id
    } else {
      servers = Self.loadServers(from: defaults)
      activeServerID = Self.loadActiveServerID(from: defaults)

      if activeServerID.flatMap({ activeID in servers.first { $0.id == activeID } }) == nil {
        activeServerID = servers.first?.id
      }
    }
  }

  var activeServer: ServerConfiguration? {
    guard let activeServerID else { return nil }
    return servers.first { $0.id == activeServerID }
  }

  var totalDownloadSpeed: String {
    isDemoMode ? "18.4 MB/s" : "—"
  }

  var totalUploadSpeed: String {
    isDemoMode ? "5.9 MB/s" : "—"
  }

  func selectServer(_ server: ServerConfiguration) {
    activeServerID = server.id
    persistActiveServerID()
  }

  func addServer(
    name: String,
    baseURLText: String,
    username: String,
    helperURLText: String
  ) throws {
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedName.isEmpty else {
      throw ServerValidationError.missingName
    }

    let baseURL = try Self.validatedHTTPURL(baseURLText, fieldName: "qBittorrent 地址")
    let helperURL = helperURLText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      ? nil
      : try Self.validatedHTTPURL(helperURLText, fieldName: "Helper 地址")

    let server = ServerConfiguration(
      name: trimmedName,
      baseURL: baseURL,
      username: username.trimmingCharacters(in: .whitespacesAndNewlines),
      helperBaseURL: helperURL
    )

    servers.append(server)
    activeServerID = server.id
    persistServers()
    persistActiveServerID()
  }

  func removeServers(atOffsets offsets: IndexSet) {
    let removedIDs = offsets.compactMap { index in
      servers.indices.contains(index) ? servers[index].id : nil
    }
    for index in offsets.sorted(by: >) where servers.indices.contains(index) {
      servers.remove(at: index)
    }

    if let activeServerID, removedIDs.contains(activeServerID) {
      self.activeServerID = servers.first?.id
      torrents = []
    }

    persistServers()
    persistActiveServerID()
  }

  func refreshTorrents() async {
    guard let activeServer else {
      torrents = []
      integrationNotice = nil
      return
    }

    isRefreshing = true
    defer { isRefreshing = false }

    do {
      torrents = try await torrentRepository.torrents(for: activeServer)
      integrationNotice = nil
      lastUpdated = .now
    } catch {
      integrationNotice = error.localizedDescription
    }
  }

  private static func validatedHTTPURL(_ text: String, fieldName: String) throws -> URL {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      let components = URLComponents(string: trimmed),
      let scheme = components.scheme?.lowercased(),
      ["http", "https"].contains(scheme),
      components.host != nil,
      let url = components.url
    else {
      throw ServerValidationError.invalidURL(fieldName)
    }
    return url
  }

  private static func loadServers(from defaults: UserDefaults) -> [ServerConfiguration] {
    guard
      let data = defaults.data(forKey: serversStorageKey),
      let servers = try? JSONDecoder().decode([ServerConfiguration].self, from: data)
    else {
      return []
    }
    return servers
  }

  private static func loadActiveServerID(from defaults: UserDefaults) -> UUID? {
    defaults.string(forKey: activeServerStorageKey).flatMap(UUID.init(uuidString:))
  }

  private func persistServers() {
    guard let data = try? JSONEncoder().encode(servers) else { return }
    defaults.set(data, forKey: Self.serversStorageKey)
  }

  private func persistActiveServerID() {
    defaults.set(activeServerID?.uuidString, forKey: Self.activeServerStorageKey)
  }
}

enum ServerValidationError: LocalizedError {
  case missingName
  case invalidURL(String)

  var errorDescription: String? {
    switch self {
    case .missingName:
      "服务器名称不能为空。"
    case .invalidURL(let fieldName):
      "\(fieldName)必须是完整的 http:// 或 https:// 地址。"
    }
  }
}
