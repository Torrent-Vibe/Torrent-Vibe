import Foundation

enum TorrentShareConstants {
  static let appGroupIdentifier = "group.dev.innei.torrent-vibe"
  static let handoffScheme = "torrentvibe"
  static let handoffHost = "shared-import"
  static let maximumFileSize = 10 * 1024 * 1024
}

struct TorrentSharePayload: Equatable, Sendable {
  enum Source: Equatable, Sendable {
    case link(String)
    case file(name: String, data: Data)
  }

  let createdAt: Date
  let id: UUID
  let source: Source

  init(id: UUID = UUID(), createdAt: Date = .now, source: Source) throws {
    self.id = id
    self.createdAt = createdAt
    self.source = try Self.validated(source)
  }

  var sourceSummary: String {
    switch source {
    case .link(let value):
      if value.lowercased().hasPrefix("magnet:") {
        return "Magnet 链接"
      }
      return "Torrent 链接"
    case .file(let name, _):
      return name
    }
  }

  private static func validated(_ source: Source) throws -> Source {
    switch source {
    case .link(let value):
      let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let components = URLComponents(string: normalized) else {
        throw TorrentShareError.invalidLink
      }
      switch components.scheme?.lowercased() {
      case "magnet":
        guard components.query?.isEmpty == false else {
          throw TorrentShareError.invalidLink
        }
      case "http", "https":
        guard components.host?.isEmpty == false else {
          throw TorrentShareError.invalidLink
        }
      default:
        throw TorrentShareError.invalidLink
      }
      return .link(normalized)

    case .file(let name, let data):
      let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
      guard normalizedName.lowercased().hasSuffix(".torrent"), !data.isEmpty else {
        throw TorrentShareError.invalidFile
      }
      guard data.count <= TorrentShareConstants.maximumFileSize else {
        throw TorrentShareError.fileTooLarge
      }
      return .file(name: normalizedName, data: data)
    }
  }
}

struct TorrentShareInbox: Sendable {
  private struct Manifest: Codable {
    enum Kind: String, Codable {
      case file
      case link
    }

    let createdAt: Date
    let fileName: String?
    let id: UUID
    let kind: Kind
    let sourceText: String?
  }

  private static let inboxDirectoryName = "shared-torrent-import"
  private static let manifestFileName = "manifest.json"
  private static let payloadFileName = "payload.torrent"

  let containerURL: URL

  static func appGroup() throws -> TorrentShareInbox {
    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: TorrentShareConstants.appGroupIdentifier
      )
    else {
      throw TorrentShareError.missingSharedContainer
    }
    return TorrentShareInbox(containerURL: containerURL)
  }

  func stage(_ payload: TorrentSharePayload) throws {
    let fileManager = FileManager.default
    let inboxURL = inboxURL
    let stagingURL = containerURL.appendingPathComponent(
      ".shared-torrent-import-\(payload.id.uuidString)",
      isDirectory: true
    )

    try? fileManager.removeItem(at: stagingURL)
    try fileManager.createDirectory(at: stagingURL, withIntermediateDirectories: true)

    let manifest: Manifest
    switch payload.source {
    case .link(let value):
      manifest = Manifest(
        createdAt: payload.createdAt,
        fileName: nil,
        id: payload.id,
        kind: .link,
        sourceText: value
      )
    case .file(let name, let data):
      try data.write(
        to: stagingURL.appendingPathComponent(Self.payloadFileName),
        options: .atomic
      )
      manifest = Manifest(
        createdAt: payload.createdAt,
        fileName: name,
        id: payload.id,
        kind: .file,
        sourceText: nil
      )
    }

    let manifestData = try JSONEncoder().encode(manifest)
    try manifestData.write(
      to: stagingURL.appendingPathComponent(Self.manifestFileName),
      options: .atomic
    )

    try? fileManager.removeItem(at: inboxURL)
    try fileManager.moveItem(at: stagingURL, to: inboxURL)
  }

  func consume() throws -> TorrentSharePayload? {
    let fileManager = FileManager.default
    let inboxURL = inboxURL
    let manifestURL = inboxURL.appendingPathComponent(Self.manifestFileName)
    guard fileManager.fileExists(atPath: manifestURL.path) else { return nil }

    let manifest = try JSONDecoder().decode(
      Manifest.self,
      from: Data(contentsOf: manifestURL)
    )
    let source: TorrentSharePayload.Source
    switch manifest.kind {
    case .link:
      guard let sourceText = manifest.sourceText else {
        throw TorrentShareError.corruptSharedPayload
      }
      source = .link(sourceText)
    case .file:
      guard let fileName = manifest.fileName else {
        throw TorrentShareError.corruptSharedPayload
      }
      let data = try Data(contentsOf: inboxURL.appendingPathComponent(Self.payloadFileName))
      source = .file(name: fileName, data: data)
    }

    let payload = try TorrentSharePayload(
      id: manifest.id,
      createdAt: manifest.createdAt,
      source: source
    )
    try fileManager.removeItem(at: inboxURL)
    return payload
  }

  func discard() throws {
    let fileManager = FileManager.default
    guard fileManager.fileExists(atPath: inboxURL.path) else { return }
    try fileManager.removeItem(at: inboxURL)
  }

  private var inboxURL: URL {
    containerURL.appendingPathComponent(Self.inboxDirectoryName, isDirectory: true)
  }
}

enum TorrentShareError: LocalizedError {
  case corruptSharedPayload
  case fileTooLarge
  case invalidFile
  case invalidLink
  case missingSharedContainer
  case unsupportedItem

  var errorDescription: String? {
    switch self {
    case .corruptSharedPayload:
      "共享内容已损坏，请重新分享。"
    case .fileTooLarge:
      "Torrent 文件不能超过 10 MB。"
    case .invalidFile:
      "请选择有效的 .torrent 文件。"
    case .invalidLink:
      "请选择 Magnet 或 HTTP(S) Torrent 链接。"
    case .missingSharedContainer:
      "Torrent Vibe 无法访问共享导入空间。"
    case .unsupportedItem:
      "此内容不是可识别的 Magnet 链接或 .torrent 文件。"
    }
  }
}
