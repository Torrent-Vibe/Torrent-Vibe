import AppIntents
import Foundation

enum TorrentShortcutRoute: Equatable, Sendable {
  case importMagnet(TorrentSharePayload)
  case refreshTasks
  case tasks

  static func parse(_ url: URL) throws -> TorrentShortcutRoute? {
    guard url.scheme?.lowercased() == TorrentShareConstants.handoffScheme else { return nil }
    switch url.host?.lowercased() {
    case "tasks":
      return .tasks
    case "refresh":
      return .refreshTasks
    case "import":
      guard
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
        let magnet = components.queryItems?.first(where: { $0.name == "magnet" })?.value,
        magnet.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
          .hasPrefix("magnet:")
      else {
        throw TorrentShareError.invalidLink
      }
      return .importMagnet(try TorrentSharePayload(source: .link(magnet)))
    default:
      return nil
    }
  }

  static func magnetImportURL(_ magnet: String) throws -> URL {
    let payload = try TorrentSharePayload(source: .link(magnet))
    guard case .link(let normalizedMagnet) = payload.source,
      normalizedMagnet.lowercased().hasPrefix("magnet:")
    else {
      throw TorrentShareError.invalidLink
    }
    var components = URLComponents()
    components.scheme = TorrentShareConstants.handoffScheme
    components.host = "import"
    components.queryItems = [URLQueryItem(name: "magnet", value: normalizedMagnet)]
    guard let url = components.url else {
      throw TorrentShareError.invalidLink
    }
    return url
  }

  static let refreshURL = URL(string: "torrentvibe://refresh")!
  static let tasksURL = URL(string: "torrentvibe://tasks")!
}

struct OpenTorrentTasksIntent: AppIntent {
  static let title: LocalizedStringResource = "打开下载任务"
  static let description = IntentDescription("打开 Torrent Vibe 的任务页面。")
  static var supportedModes: IntentModes { .foreground(.immediate) }

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TorrentShortcutRoute.tasksURL))
  }
}

struct RefreshTorrentTasksIntent: AppIntent {
  static let title: LocalizedStringResource = "刷新下载任务"
  static let description = IntentDescription("打开 Torrent Vibe 并刷新当前服务器的任务状态。")
  static var supportedModes: IntentModes { .foreground(.immediate) }

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TorrentShortcutRoute.refreshURL))
  }
}

struct AddMagnetIntent: AppIntent {
  static let title: LocalizedStringResource = "添加 Magnet"
  static let description = IntentDescription("将 Magnet 链接交给 Torrent Vibe 的导入确认页。")
  static var supportedModes: IntentModes { .foreground(.immediate) }

  @Parameter(title: "Magnet 链接")
  var magnet: String

  static var parameterSummary: some ParameterSummary {
    Summary("添加 \(\.$magnet)")
  }

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(try TorrentShortcutRoute.magnetImportURL(magnet)))
  }
}

struct TorrentVibeAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenTorrentTasksIntent(),
      phrases: [
        "在 \(.applicationName) 打开下载任务",
        "用 \(.applicationName) 查看任务",
      ],
      shortTitle: "打开任务",
      systemImageName: "arrow.down.circle"
    )
    AppShortcut(
      intent: RefreshTorrentTasksIntent(),
      phrases: [
        "用 \(.applicationName) 刷新下载任务",
        "在 \(.applicationName) 更新任务",
      ],
      shortTitle: "刷新任务",
      systemImageName: "arrow.clockwise"
    )
    AppShortcut(
      intent: AddMagnetIntent(),
      phrases: [
        "用 \(.applicationName) 添加 Magnet",
        "在 \(.applicationName) 导入 Magnet",
      ],
      shortTitle: "添加 Magnet",
      systemImageName: "link.badge.plus"
    )
  }

  static var shortcutTileColor: ShortcutTileColor { .blue }
}
