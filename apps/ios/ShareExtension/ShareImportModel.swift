import Foundation
import Observation
import UniformTypeIdentifiers

struct TorrentShareItemProvider: @unchecked Sendable {
  let value: NSItemProvider
}

@MainActor
@Observable
final class ShareImportModel {
  enum Phase: Equatable {
    case failed
    case loading
    case ready
  }

  private(set) var errorMessage: String?
  private(set) var isOpeningApp = false
  private(set) var payload: TorrentSharePayload?
  private(set) var phase: Phase = .loading

  var sourceTitle: String {
    guard let payload else { return "正在读取分享内容…" }
    return payload.sourceSummary
  }

  var handoffURL: URL {
    var components = URLComponents()
    components.scheme = TorrentShareConstants.handoffScheme
    components.host = TorrentShareConstants.handoffHost
    guard let url = components.url else {
      preconditionFailure("The shared Torrent handoff URL must be valid.")
    }
    return url
  }

  var sourceDetail: String {
    guard let payload else { return "支持 Magnet 链接与单个 .torrent 文件" }
    switch payload.source {
    case .link(let value):
      return value
    case .file(_, let data):
      return ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)
    }
  }

  func load(inputItems: [NSExtensionItem]) {
    let providers = inputItems.compactMap(\.attachments).flatMap { $0 }
      .map(TorrentShareItemProvider.init(value:))
    guard !providers.isEmpty else {
      fail(with: TorrentShareError.unsupportedItem)
      return
    }

    phase = .loading
    errorMessage = nil
    Task {
      do {
        payload = try await Self.loadPayload(from: providers)
        phase = .ready
      } catch {
        fail(with: error)
      }
    }
  }

  func beginHandoff() {
    do {
      guard let payload else { throw TorrentShareError.unsupportedItem }
      try TorrentShareInbox.appGroup().stage(payload)
      isOpeningApp = true
      errorMessage = nil
    } catch {
      fail(with: error)
    }
  }

  func cancel() {
    try? TorrentShareInbox.appGroup().discard()
  }

  func fail(with error: Error) {
    phase = .failed
    isOpeningApp = false
    errorMessage = error.localizedDescription
  }

  private static func loadPayload(
    from providers: [TorrentShareItemProvider]
  ) async throws -> TorrentSharePayload {
    if let fileProvider = providers.first(where: isTorrentFileProvider) {
      let file = try await loadFile(from: fileProvider.value)
      return try TorrentSharePayload(source: .file(name: file.name, data: file.data))
    }

    for provider in providers {
      if let value = try await loadSharedText(from: provider.value) {
        return try TorrentSharePayload(source: .link(value))
      }
    }

    throw TorrentShareError.unsupportedItem
  }

  private static func isTorrentFileProvider(_ provider: TorrentShareItemProvider) -> Bool {
    if provider.value.suggestedName?.lowercased().hasSuffix(".torrent") == true {
      return true
    }
    return provider.value.registeredTypeIdentifiers.contains { identifier in
      UTType(identifier)?.preferredFilenameExtension?.lowercased() == "torrent"
    }
  }

  private struct LoadedFile: Sendable {
    let data: Data
    let name: String
  }

  private static func loadFile(from provider: NSItemProvider) async throws -> LoadedFile {
    let typeIdentifier =
      provider.registeredTypeIdentifiers.first { identifier in
        UTType(identifier)?.preferredFilenameExtension?.lowercased() == "torrent"
      } ?? provider.registeredTypeIdentifiers.first

    guard let typeIdentifier else { throw TorrentShareError.invalidFile }
    let suggestedName = provider.suggestedName
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
        do {
          if let error { throw error }
          guard let url else { throw TorrentShareError.invalidFile }
          let data = try Data(contentsOf: url, options: .mappedIfSafe)
          let rawName = suggestedName?.isEmpty == false ? suggestedName : url.lastPathComponent
          let name =
            rawName?.lowercased().hasSuffix(".torrent") == true
            ? rawName!
            : "\(rawName ?? "Shared").torrent"
          continuation.resume(returning: LoadedFile(data: data, name: name))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private static func loadSharedText(from provider: NSItemProvider) async throws -> String? {
    let typeIdentifier: String?
    if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
      typeIdentifier = UTType.url.identifier
    } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
      typeIdentifier = UTType.plainText.identifier
    } else {
      typeIdentifier = nil
    }
    guard let typeIdentifier else { return nil }

    return try await withCheckedThrowingContinuation { continuation in
      provider.loadItem(forTypeIdentifier: typeIdentifier) { item, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        if let url = item as? URL {
          continuation.resume(returning: url.absoluteString)
        } else if let string = item as? String {
          continuation.resume(returning: string)
        } else if let string = item as? NSString {
          continuation.resume(returning: string as String)
        } else {
          continuation.resume(returning: nil)
        }
      }
    }
  }
}
