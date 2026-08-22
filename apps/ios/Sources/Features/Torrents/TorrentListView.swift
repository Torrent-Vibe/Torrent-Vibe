import Foundation
import Observation
import SwiftUI
import UIKit

final class TorrentViewController: SwiftUIHostingViewController, UISearchResultsUpdating {
  var onOpenServers: (() -> Void)?

  private var didPresentLiveActivityDemo = false
  private let launchesLiveActivityDemo = ProcessInfo.processInfo.arguments.contains(
    "-ui-live-activity-demo"
  )
  private let model: AppModel
  private let searchState = TorrentSearchState()
  private let selectionState = TorrentSelectionState()
  private weak var selectAllItem: UIBarButtonItem?
  private lazy var addButton = UIBarButtonItem(
    barButtonSystemItem: .add,
    target: self,
    action: #selector(addTorrent)
  )
  private lazy var selectButton = UIBarButtonItem(
    image: UIImage(systemName: "checkmark.circle"),
    style: .plain,
    target: self,
    action: #selector(beginSelection)
  )

  init(model: AppModel) {
    self.model = model
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "任务"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never

    searchState.activate(serverID: model.activeServerID)
    host(
      TorrentContentView(
        onOpenServers: { [weak self] in
          self?.onOpenServers?()
        },
        onOpenTorrent: { [weak self] torrent in
          self?.showDetail(for: torrent)
        },
        onDeleteTorrent: { [weak self] torrent in
          self?.confirmDelete(torrents: [torrent])
        },
        onManageTorrent: { [weak self] torrent in
          self?.presentManagement(for: torrent)
        },
        onToggleSelection: { [weak self] torrent in
          self?.toggleSelection(for: torrent)
        },
        onTogglePause: { [weak self] torrent in
          self?.togglePause(for: torrent)
        }
      )
      .environment(model)
      .environment(searchState)
      .environment(selectionState)
    )

    configureSearchController()
    addButton.accessibilityLabel = "添加 Torrent"
    addButton.accessibilityIdentifier = "torrent-add"
    selectButton.accessibilityLabel = "选择任务"
    selectButton.accessibilityIdentifier = "torrent-select"
    navigationItem.rightBarButtonItems = [addButton, selectButton]
    updateServerMenu()
    observeNavigationSubtitle()

    Task { await refresh() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    searchState.activate(serverID: model.activeServerID)
    updateServerMenu()
    if model.activeServer != nil, model.torrents.isEmpty, !model.isRefreshing {
      Task { await refresh() }
    }
  }

  func updateSearchResults(for searchController: UISearchController) {
    searchState.query = searchController.searchBar.text ?? ""
  }

  private func configureSearchController() {
    let searchController = UISearchController(searchResultsController: nil)
    searchController.obscuresBackgroundDuringPresentation = false
    searchController.searchResultsUpdater = self
    searchController.searchBar.placeholder = "搜索任务"
    searchController.searchBar.accessibilityIdentifier = "torrent-search"
    navigationItem.searchController = searchController
    definesPresentationContext = true
  }

  private func updateServerMenu() {
    guard !model.servers.isEmpty else {
      navigationItem.leftBarButtonItem = nil
      addButton.isEnabled = false
      selectButton.isEnabled = false
      return
    }

    let actions = model.servers.map { server in
      UIAction(
        title: server.name,
        image: server.id == model.activeServerID ? UIImage(systemName: "checkmark") : nil,
        state: server.id == model.activeServerID ? .on : .off
      ) { [weak self] _ in
        guard let self else { return }
        searchState.activate(serverID: server.id)
        model.selectServer(server)
        updateServerMenu()
        Task { await refresh() }
      }
    }

    let button = UIBarButtonItem(
      image: UIImage(systemName: "externaldrive"),
      menu: UIMenu(title: "选择服务器", children: actions)
    )
    button.accessibilityLabel = model.activeServer?.name ?? "选择服务器"
    button.accessibilityIdentifier = "torrent-server-menu"
    navigationItem.leftBarButtonItem = button
    addButton.isEnabled = true
    selectButton.isEnabled = !model.torrents.isEmpty
  }

  @objc private func addTorrent() {
    TorrentImportViewController.present(
      from: self,
      model: model,
      draft: .empty
    ) { [weak self] server in
      guard let self else { return }
      TorrentImportViewController.presentSuccess(on: self, server: server)
    }
  }

  @objc private func beginSelection() {
    guard !model.torrents.isEmpty else { return }
    selectionState.begin()
    navigationItem.leftBarButtonItem?.isEnabled = false
    let done = UIBarButtonItem(
      title: "完成",
      style: .prominent,
      target: self,
      action: #selector(endSelection)
    )
    done.accessibilityIdentifier = "torrent-select-done"
    navigationItem.rightBarButtonItems = [done]
    tabBarController?.setTabBarHidden(true, animated: false)
    configureSelectionToolbar()
    updateSelectionChrome()
  }

  @objc private func endSelection() {
    selectionState.end()
    navigationItem.leftBarButtonItem?.isEnabled = true
    navigationItem.rightBarButtonItems = [addButton, selectButton]
    navigationController?.setToolbarHidden(true, animated: false)
    DispatchQueue.main.async { [weak self] in
      guard let self, !selectionState.isSelecting else { return }
      tabBarController?.setTabBarHidden(false, animated: false)
    }
    updateSelectionChrome()
  }

  @objc private func toggleSelectAll() {
    guard !selectionState.isPerformingAction else { return }
    if selectionState.selectedIDs.count == model.torrents.count {
      selectionState.selectedIDs.removeAll()
    } else {
      selectionState.selectedIDs = Set(model.torrents.map(\.id))
    }
    updateSelectionChrome()
  }

  private func toggleSelection(for torrent: TorrentSummary) {
    selectionState.toggle(torrent.id)
    updateSelectionChrome()
  }

  private func configureSelectionToolbar() {
    let selectAll = UIBarButtonItem(
      title: "全选",
      style: .plain,
      target: self,
      action: #selector(toggleSelectAll)
    )
    selectAll.accessibilityIdentifier = "torrent-select-all"
    selectAllItem = selectAll

    let pause = UIBarButtonItem(
      image: UIImage(systemName: "pause.fill"),
      style: .plain,
      target: self,
      action: #selector(pauseSelected)
    )
    pause.accessibilityLabel = "暂停所选任务"
    pause.accessibilityIdentifier = "torrent-selection-pause"
    pause.tag = 1

    let resume = UIBarButtonItem(
      image: UIImage(systemName: "play.fill"),
      style: .plain,
      target: self,
      action: #selector(resumeSelected)
    )
    resume.accessibilityLabel = "继续所选任务"
    resume.accessibilityIdentifier = "torrent-selection-resume"
    resume.tag = 2

    let delete = UIBarButtonItem(
      image: UIImage(systemName: "trash"),
      style: .plain,
      target: self,
      action: #selector(deleteSelected)
    )
    delete.tintColor = .systemRed
    delete.accessibilityLabel = "删除所选任务"
    delete.accessibilityIdentifier = "torrent-selection-delete"
    delete.tag = 3

    toolbarItems = [
      selectAll,
      UIBarButtonItem(systemItem: .flexibleSpace),
      pause,
      fixedSpace(),
      resume,
      fixedSpace(),
      delete,
    ]
    DispatchQueue.main.async { [weak self] in
      guard let self, selectionState.isSelecting else { return }
      navigationController?.setToolbarHidden(false, animated: false)
    }
    updateSelectionChrome()
  }

  private func fixedSpace(_ width: CGFloat = 12) -> UIBarButtonItem {
    .fixedSpace(width)
  }

  private func updateSelectionChrome() {
    let selectedCount = selectionState.selectedIDs.count
    let totalCount = model.torrents.count
    let isEnabled = !selectionState.selectedIDs.isEmpty && !selectionState.isPerformingAction
    for item in toolbarItems ?? [] where item.tag > 0 {
      item.isEnabled = isEnabled
    }
    selectAllItem?.title = selectedCount == totalCount && totalCount > 0 ? "取消全选" : "全选"
    if selectionState.isSelecting {
      title = selectedCount > 0 ? "已选 \(selectedCount)" : "选择任务"
    } else {
      title = "任务"
    }
    updateNavigationSubtitle()
  }

  private func observeNavigationSubtitle() {
    withObservationTracking {
      updateNavigationSubtitle()
    } onChange: { [weak self] in
      Task { @MainActor in
        self?.observeNavigationSubtitle()
      }
    }
  }

  private func updateNavigationSubtitle() {
    let hasActiveTransfer =
      model.totalDownloadBytesPerSecond > 0 || model.totalUploadBytesPerSecond > 0
    let subtitle =
      selectionState.isSelecting || !hasActiveTransfer
      ? nil
      : "↓ \(model.totalDownloadSpeed)  ↑ \(model.totalUploadSpeed)"

    guard navigationItem.subtitle != subtitle else { return }
    UIView.performWithoutAnimation {
      navigationItem.subtitle = subtitle
      navigationController?.navigationBar.layoutIfNeeded()
    }
  }

  @objc private func pauseSelected() {
    performSelectionPause(paused: true)
  }

  @objc private func resumeSelected() {
    performSelectionPause(paused: false)
  }

  @objc private func deleteSelected() {
    let selected = model.torrents.filter { selectionState.selectedIDs.contains($0.id) }
    confirmDelete(torrents: selected)
  }

  private func performSelectionPause(paused: Bool) {
    guard let serverID = model.activeServerID, !selectionState.selectedIDs.isEmpty else { return }
    selectionState.isPerformingAction = true
    updateSelectionChrome()
    Task {
      do {
        try await model.setTorrentsPaused(
          torrentIDs: Array(selectionState.selectedIDs),
          paused: paused,
          serverID: serverID
        )
        endSelection()
      } catch {
        selectionState.isPerformingAction = false
        updateSelectionChrome()
        presentError(error)
      }
    }
  }

  private func showDetail(for torrent: TorrentSummary) {
    guard let serverID = model.activeServerID else { return }
    navigationController?.pushViewController(
      TorrentDetailViewController(
        model: model,
        torrent: torrent,
        serverID: serverID
      ),
      animated: true
    )
  }

  private func presentManagement(for torrent: TorrentSummary) {
    guard let serverID = model.activeServerID else { return }
    TorrentManagementViewController.present(
      from: self,
      model: model,
      torrent: torrent,
      serverID: serverID
    ) { _ in }
  }

  private func confirmDelete(torrents: [TorrentSummary]) {
    guard !torrents.isEmpty else { return }
    let title = torrents.count == 1 ? "移除“\(torrents[0].name)”？" : "移除 \(torrents.count) 个任务？"
    let alert = UIAlertController(
      title: title,
      message: "请选择是否同时删除服务器上的已下载文件。此操作无法撤销。",
      preferredStyle: .actionSheet
    )
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(
      UIAlertAction(title: "仅移除任务，保留文件", style: .default) { [weak self] _ in
        self?.performDelete(torrents: torrents, deleteFiles: false)
      })
    alert.addAction(
      UIAlertAction(title: "移除任务并删除文件", style: .destructive) { [weak self] _ in
        self?.performDelete(torrents: torrents, deleteFiles: true)
      })
    if let popover = alert.popoverPresentationController {
      popover.barButtonItem =
        selectionState.isSelecting
        ? toolbarItems?.first(where: { $0.tag == 3 })
        : navigationItem.rightBarButtonItems?.last
    }
    present(alert, animated: true)
  }

  private func performDelete(torrents: [TorrentSummary], deleteFiles: Bool) {
    guard let serverID = model.activeServerID else { return }
    let ids = torrents.map(\.id)
    selectionState.isPerformingAction = true
    updateSelectionChrome()
    Task {
      do {
        try await model.deleteTorrents(
          torrentIDs: ids,
          deleteFiles: deleteFiles,
          serverID: serverID
        )
        if selectionState.isSelecting {
          endSelection()
        } else {
          selectionState.isPerformingAction = false
        }
        selectButton.isEnabled = !model.torrents.isEmpty
      } catch {
        selectionState.isPerformingAction = false
        updateSelectionChrome()
        presentError(error)
      }
    }
  }

  private func togglePause(for torrent: TorrentSummary) {
    guard let serverID = model.activeServerID else { return }
    Task {
      do {
        try await model.setTorrentPaused(
          torrentID: torrent.id,
          paused: !torrent.isPaused,
          serverID: serverID
        )
      } catch {
        presentError(error)
      }
    }
  }

  private func presentError(_ error: Error) {
    let alert = UIAlertController(
      title: "无法更新任务",
      message: error.localizedDescription,
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "完成", style: .default))
    present(alert, animated: true)
  }

  private func refresh() async {
    await model.refreshTorrents()
    selectButton.isEnabled = !model.torrents.isEmpty

    if launchesLiveActivityDemo,
      !didPresentLiveActivityDemo,
      let torrent = model.torrents.first(where: { $0.status == .downloading })
    {
      didPresentLiveActivityDemo = true
      showDetail(for: torrent)
    }
  }
}
