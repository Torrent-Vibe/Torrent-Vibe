import UIKit

final class RootTabBarController: UITabBarController {
  var onAppearanceModeChange: ((AppearanceMode) -> Void)?

  private let model: AppModel
  private let backgroundStatusService: TorrentBackgroundStatusService
  private let mikanRuntime: MikanRuntimeInstallation
  private weak var torrentsNavigationController: UINavigationController?

  init(model: AppModel) {
    self.model = model
    backgroundStatusService = TorrentBackgroundStatusService(model: model)
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
    let settings = SettingsViewController(
      model: model,
      mikanRuntime: mikanRuntime,
      backgroundStatusService: backgroundStatusService
    )

    torrents.onOpenServers = { [weak self] in
      self?.selectedIndex = 2
      settings.showServers()
    }
    discover.onOpenContentSources = { [weak self] in
      self?.selectedIndex = 2
      settings.showContentSources()
    }
    settings.onAppearanceModeChange = { [weak self] mode in
      self?.onAppearanceModeChange?(mode)
    }

    let torrentsNavigationController = makeNavigationController(
      root: torrents,
      title: "任务",
      systemImage: "arrow.down.circle",
      accessibilityIdentifier: "tab-torrents"
    )
    self.torrentsNavigationController = torrentsNavigationController

    return [
      torrentsNavigationController,
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

  func presentSharedTorrentImport(_ payload: TorrentSharePayload) {
    presentTorrentImport(draft: .shared(payload))
  }

  func presentShortcutTorrentImport(_ payload: TorrentSharePayload) {
    presentTorrentImport(draft: .shortcut(payload))
  }

  private func presentTorrentImport(draft: TorrentImportDraft) {
    selectedIndex = 0
    guard let navigationController = torrentsNavigationController else { return }

    if let presentedController =
      navigationController.presentedViewController ?? presentedViewController
    {
      presentedController.dismiss(animated: false) { [weak self, weak navigationController] in
        guard let self, let navigationController else { return }
        self.showTorrentImport(draft: draft, in: navigationController)
      }
    } else {
      showTorrentImport(draft: draft, in: navigationController)
    }
  }

  func showTasks(refreshes: Bool) {
    selectedIndex = 0
    torrentsNavigationController?.popToRootViewController(animated: false)
    guard refreshes else { return }
    Task { await model.refreshTorrents() }
  }

  func presentSharedTorrentImportError(_ message: String) {
    guard presentedViewController == nil else { return }
    let alert = UIAlertController(
      title: "无法读取分享内容",
      message: message,
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "好", style: .default))
    alert.view.accessibilityIdentifier = "shared-import-error"
    present(alert, animated: true)
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

  private func showTorrentImport(
    draft: TorrentImportDraft,
    in navigationController: UINavigationController
  ) {
    let presenter = navigationController.visibleViewController ?? navigationController
    TorrentImportViewController.present(
      from: presenter,
      model: model,
      draft: draft
    ) { [weak presenter] server in
      guard let presenter else { return }
      TorrentImportViewController.presentSuccess(on: presenter, server: server)
    }
  }
}
