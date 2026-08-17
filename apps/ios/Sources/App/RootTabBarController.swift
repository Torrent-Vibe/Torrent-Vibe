import UIKit

final class RootTabBarController: UITabBarController {
  var onAppearanceModeChange: ((AppearanceMode) -> Void)?

  private let model: AppModel
  private let mikanRuntime: MikanRuntimeInstallation

  init(model: AppModel) {
    self.model = model
    do {
      mikanRuntime = .available(try MikanJavaScriptRuntime())
    } catch {
      mikanRuntime = .unavailable(error.localizedDescription)
    }
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    viewControllers = makeViewControllers()
    selectedIndex = 0
  }

  private func makeViewControllers() -> [UIViewController] {
    let torrents = TorrentViewController(model: model)
    let discover = DiscoverViewController(model: model, mikanRuntime: mikanRuntime)
    let settings = SettingsViewController(model: model, mikanRuntime: mikanRuntime)

    torrents.onOpenServers = { [weak self] in
      self?.selectedIndex = 2
      settings.showServers()
    }
    settings.onAppearanceModeChange = { [weak self] mode in
      self?.onAppearanceModeChange?(mode)
    }

    return [
      makeNavigationController(
        root: torrents,
        title: "任务",
        systemImage: "arrow.down.circle",
        accessibilityIdentifier: "tab-torrents"
      ),
      makeNavigationController(
        root: discover,
        title: "发现",
        systemImage: "safari",
        accessibilityIdentifier: "tab-discover"
      ),
      makeNavigationController(
        root: settings,
        title: "设置",
        systemImage: "gearshape",
        accessibilityIdentifier: "tab-settings"
      ),
    ]
  }

  private func makeNavigationController(
    root: UIViewController,
    title: String,
    systemImage: String,
    accessibilityIdentifier: String
  ) -> UINavigationController {
    let navigationController = UINavigationController(rootViewController: root)
    navigationController.navigationBar.prefersLargeTitles = true
    navigationController.tabBarItem = UITabBarItem(
      title: title,
      image: UIImage(systemName: systemImage),
      selectedImage: nil
    )
    navigationController.tabBarItem.accessibilityIdentifier = accessibilityIdentifier
    return navigationController
  }
}
