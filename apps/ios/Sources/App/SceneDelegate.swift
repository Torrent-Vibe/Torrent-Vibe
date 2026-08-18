import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var appModel: AppModel?
  private var launchDiscovery: HelperDiscoveryModel?

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
    window = appWindow
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    requestLaunchAccess()
  }

  private func requestLaunchAccess() {
    guard let model = appModel, !model.isDemoMode else { return }
    if launchDiscovery == nil {
      let discovery = HelperDiscoveryModel(demoMode: false)
      discovery.start()
      launchDiscovery = discovery
    }
    Task { await model.refreshTorrents() }
  }
}
