import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var appModel: AppModel?
  private var foregroundRefreshTask: Task<Void, Never>?
  private var launchDiscovery: HelperDiscoveryModel?
  private weak var rootViewController: RootTabBarController?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let model = AppModel()
    let rootViewController = RootTabBarController(model: model)
    let appWindow = UIWindow(windowScene: windowScene)

    rootViewController.onAppearanceModeChange = { [weak appWindow] mode in
      appWindow?.overrideUserInterfaceStyle = mode.userInterfaceStyle
    }

    let storedMode = UserDefaults.standard.string(forKey: "appearanceMode")
    let appearanceMode = AppearanceMode(rawValue: storedMode ?? "") ?? .system
    appWindow.overrideUserInterfaceStyle = appearanceMode.userInterfaceStyle
    appWindow.rootViewController = rootViewController
    appWindow.makeKeyAndVisible()

    appModel = model
    self.rootViewController = rootViewController
    window = appWindow

    if !connectionOptions.urlContexts.isEmpty {
      DispatchQueue.main.async { [weak self] in
        for context in connectionOptions.urlContexts {
          _ = self?.route(context.url, showErrors: true)
        }
      }
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    requestLaunchAccess()
    consumeSharedTorrentImport(showErrors: false)
    startForegroundRefresh()
  }

  func sceneWillResignActive(_ scene: UIScene) {
    foregroundRefreshTask?.cancel()
    foregroundRefreshTask = nil
  }

  func scene(_ scene: UIScene, openURLContexts urlContexts: Set<UIOpenURLContext>) {
    for context in urlContexts {
      _ = route(context.url, showErrors: true)
    }
  }

  private func requestLaunchAccess() {
    guard let model = appModel, !model.isDemoMode else { return }
    if launchDiscovery == nil {
      let discovery = HelperDiscoveryModel(demoMode: false)
      discovery.start()
      launchDiscovery = discovery
    }
  }

  private func startForegroundRefresh() {
    guard let model = appModel else { return }
    foregroundRefreshTask?.cancel()
    foregroundRefreshTask = Task { @MainActor in
      while !Task.isCancelled {
        await model.refreshTorrents()
        let configuredInterval = UserDefaults.standard.integer(forKey: "refreshInterval")
        let interval = max(configuredInterval, 5)
        do {
          try await Task.sleep(for: .seconds(interval))
        } catch {
          return
        }
      }
    }
  }

  @discardableResult
  private func consumeSharedTorrentImport(showErrors: Bool) -> Bool {
    do {
      guard let payload = try TorrentShareInbox.appGroup().consume() else { return false }
      rootViewController?.presentSharedTorrentImport(payload)
      return true
    } catch {
      if showErrors {
        rootViewController?.presentSharedTorrentImportError(error.localizedDescription)
      }
      return false
    }
  }

  private static func isSharedImportURL(_ url: URL) -> Bool {
    url.scheme?.lowercased() == TorrentShareConstants.handoffScheme
      && url.host?.lowercased() == TorrentShareConstants.handoffHost
  }

  @discardableResult
  private func route(_ url: URL, showErrors: Bool) -> Bool {
    if Self.isSharedImportURL(url) {
      return consumeSharedTorrentImport(showErrors: showErrors)
    }

    do {
      guard let shortcutRoute = try TorrentShortcutRoute.parse(url) else { return false }
      switch shortcutRoute {
      case .tasks:
        rootViewController?.showTasks(refreshes: false)
      case .refreshTasks:
        rootViewController?.showTasks(refreshes: true)
      case .importMagnet(let payload):
        rootViewController?.presentShortcutTorrentImport(payload)
      }
      return true
    } catch {
      if showErrors {
        rootViewController?.presentSharedTorrentImportError(error.localizedDescription)
      }
      return false
    }
  }
}
