import Foundation
import Observation
import SwiftUI
import UIKit

private enum TorrentFilter: String, CaseIterable, Identifiable {
  case all
  case completed
  case downloading
  case error
  case paused
  case seeding

  var id: String { rawValue }

  var title: String {
    switch self {
    case .all: "全部"
    case .downloading: "下载中"
    case .seeding: "做种"
    case .completed: "已完成"
    case .paused: "已暂停"
    case .error: "错误"
    }
  }

  var systemImage: String {
    switch self {
    case .all: "tray.full"
    case .downloading: "arrow.down.circle"
    case .seeding: "arrow.up.circle"
    case .completed: "checkmark.circle"
    case .paused: "pause.circle"
    case .error: "exclamationmark.circle"
    }
  }

  func includes(_ torrent: TorrentSummary) -> Bool {
    switch self {
    case .all: true
    case .completed: torrent.status == .completed
    case .downloading: torrent.status == .downloading
    case .error: torrent.status == .error
    case .paused: torrent.status == .paused
    case .seeding: torrent.status == .seeding
    }
  }
}

@MainActor
@Observable
private final class TorrentSearchState {
  private var filtersByServerID: [UUID: TorrentFilter] = [:]
  private var serverID: UUID?

  var filter: TorrentFilter = .all
  var query = ""

  func activate(serverID: UUID?) {
    if let currentServerID = self.serverID {
      filtersByServerID[currentServerID] = filter
    }
    self.serverID = serverID
    filter = serverID.flatMap { filtersByServerID[$0] } ?? .all
  }

  func select(_ filter: TorrentFilter) {
    self.filter = filter
    if let serverID {
      filtersByServerID[serverID] = filter
    }
  }
}

@MainActor
@Observable
private final class TorrentSelectionState {
  var isPerformingAction = false
  var isSelecting = false
  var selectedIDs = Set<String>()

  func begin() {
    selectedIDs.removeAll()
    isSelecting = true
  }

  func end() {
    selectedIDs.removeAll()
    isPerformingAction = false
    isSelecting = false
  }

  func toggle(_ torrentID: String) {
    if selectedIDs.contains(torrentID) {
      selectedIDs.remove(torrentID)
    } else {
      selectedIDs.insert(torrentID)
    }
  }
}

final class TorrentViewController: SwiftUIHostingViewController, UISearchResultsUpdating {
  var onOpenServers: (() -> Void)?

  private var didPresentLiveActivityDemo = false
  private let launchesLiveActivityDemo = ProcessInfo.processInfo.arguments.contains(
    "-ui-live-activity-demo"
  )
  private let model: AppModel
  private let searchState = TorrentSearchState()
  private let selectionState = TorrentSelectionState()
  private lazy var addButton = UIBarButtonItem(
    barButtonSystemItem: .add,
    target: self,
    action: #selector(addTorrent)
  )
  private lazy var refreshButton = UIBarButtonItem(
    barButtonSystemItem: .refresh,
    target: self,
    action: #selector(refreshTorrents)
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
    navigationItem.largeTitleDisplayMode = .always

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
    refreshButton.accessibilityLabel = "刷新任务"
    refreshButton.accessibilityIdentifier = "torrent-refresh"
    selectButton.accessibilityLabel = "选择任务"
    selectButton.accessibilityIdentifier = "torrent-select"
    navigationItem.rightBarButtonItems = [addButton, refreshButton, selectButton]
    updateServerMenu()

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
    navigationItem.hidesSearchBarWhenScrolling = false
    definesPresentationContext = true
  }

  private func updateServerMenu() {
    guard !model.servers.isEmpty else {
      navigationItem.leftBarButtonItem = nil
      addButton.isEnabled = false
      refreshButton.isEnabled = false
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
    refreshButton.isEnabled = true
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

  @objc private func refreshTorrents() {
    Task { await refresh() }
  }

  @objc private func beginSelection() {
    guard !model.torrents.isEmpty else { return }
    selectionState.begin()
    navigationItem.leftBarButtonItem?.isEnabled = false
    navigationItem.rightBarButtonItems = [
      UIBarButtonItem(
        title: "完成",
        style: .prominent,
        target: self,
        action: #selector(endSelection)
      )
    ]
    navigationItem.rightBarButtonItems?.first?.accessibilityIdentifier = "torrent-select-done"
    tabBarController?.setTabBarHidden(true, animated: false)
    configureSelectionToolbar()
  }

  @objc private func endSelection() {
    selectionState.end()
    navigationItem.leftBarButtonItem?.isEnabled = true
    navigationItem.rightBarButtonItems = [addButton, refreshButton, selectButton]
    navigationController?.setToolbarHidden(true, animated: false)
    DispatchQueue.main.async { [weak self] in
      guard let self, !selectionState.isSelecting else { return }
      tabBarController?.setTabBarHidden(false, animated: false)
    }
  }

  private func toggleSelection(for torrent: TorrentSummary) {
    selectionState.toggle(torrent.id)
    updateSelectionToolbar()
  }

  private func configureSelectionToolbar() {
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
      pause,
      UIBarButtonItem(systemItem: .flexibleSpace),
      resume,
      UIBarButtonItem(systemItem: .flexibleSpace),
      delete,
    ]
    DispatchQueue.main.async { [weak self] in
      guard let self, selectionState.isSelecting else { return }
      navigationController?.setToolbarHidden(false, animated: false)
    }
    updateSelectionToolbar()
  }

  private func updateSelectionToolbar() {
    let isEnabled = !selectionState.selectedIDs.isEmpty && !selectionState.isPerformingAction
    for item in toolbarItems ?? [] {
      if item.tag > 0 {
        item.isEnabled = isEnabled
      }
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
    updateSelectionToolbar()
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
        updateSelectionToolbar()
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
    updateSelectionToolbar()
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
        updateSelectionToolbar()
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
    refreshButton.isEnabled = false
    await model.refreshTorrents()
    refreshButton.isEnabled = model.activeServer != nil
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

private struct TorrentContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentSearchState.self) private var searchState
  @Environment(TorrentSelectionState.self) private var selectionState

  let onOpenServers: () -> Void
  let onOpenTorrent: (TorrentSummary) -> Void
  let onDeleteTorrent: (TorrentSummary) -> Void
  let onManageTorrent: (TorrentSummary) -> Void
  let onToggleSelection: (TorrentSummary) -> Void
  let onTogglePause: (TorrentSummary) -> Void

  private var filteredTorrents: [TorrentSummary] {
    let scoped = model.torrents.filter(searchState.filter.includes)
    let query = searchState.query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return scoped }
    return scoped.filter {
      $0.name.localizedCaseInsensitiveContains(query)
    }
  }

  var body: some View {
    Group {
      if model.activeServer == nil {
        ContentUnavailableView {
          Label("尚未添加服务器", systemImage: "externaldrive.badge.plus")
        } description: {
          Text("先添加一台 qBittorrent 服务器，再开始管理下载任务。")
        } actions: {
          Button("前往服务器", action: onOpenServers)
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("torrent-open-servers")
        }
      } else if model.torrents.isEmpty {
        ContentUnavailableView {
          Label("任务将在连接后显示", systemImage: "arrow.down.circle")
        } description: {
          Text(model.integrationNotice ?? "当前服务器没有符合条件的任务。")
        }
      } else {
        List {
          Section {
            TorrentOverviewCard(
              downloadSpeed: model.totalDownloadSpeed,
              uploadSpeed: model.totalUploadSpeed,
              taskCount: model.torrents.count
            )
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
          }

          Section {
            if filteredTorrents.isEmpty {
              ContentUnavailableView {
                Label("当前范围没有任务", systemImage: searchState.filter.systemImage)
              } description: {
                Text("可更换状态范围或搜索关键词。")
              }
              .accessibilityIdentifier("torrent-filter-empty")
            } else {
              ForEach(filteredTorrents) { torrent in
                Button {
                  if selectionState.isSelecting {
                    onToggleSelection(torrent)
                  } else {
                    onOpenTorrent(torrent)
                  }
                } label: {
                  TorrentRow(
                    torrent: torrent,
                    isSelecting: selectionState.isSelecting,
                    isSelected: selectionState.selectedIDs.contains(torrent.id)
                  )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("torrent-row-\(torrent.id)")
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                  if !selectionState.isSelecting {
                    Button {
                      onTogglePause(torrent)
                    } label: {
                      Label(
                        torrent.isPaused ? "继续" : "暂停",
                        systemImage: torrent.isPaused ? "play.fill" : "pause.fill"
                      )
                    }
                    .tint(torrent.isPaused ? .green : .orange)
                  }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                  if !selectionState.isSelecting {
                    Button(role: .destructive) {
                      onDeleteTorrent(torrent)
                    } label: {
                      Label("删除", systemImage: "trash")
                    }
                  }
                }
                .contextMenu {
                  if !selectionState.isSelecting {
                    Button {
                      onTogglePause(torrent)
                    } label: {
                      Label(
                        torrent.isPaused ? "继续" : "暂停",
                        systemImage: torrent.isPaused ? "play.fill" : "pause.fill"
                      )
                    }
                    Button {
                      onManageTorrent(torrent)
                    } label: {
                      Label("分类、标签与限速", systemImage: "slider.horizontal.3")
                    }
                    Divider()
                    Button(role: .destructive) {
                      onDeleteTorrent(torrent)
                    } label: {
                      Label("删除", systemImage: "trash")
                    }
                  }
                }
              }
            }
          } header: {
            HStack {
              Label(
                model.activeServer?.name ?? "当前服务器",
                systemImage: "externaldrive"
              )
              Spacer()
              Menu {
                ForEach(TorrentFilter.allCases) { filter in
                  Button {
                    searchState.select(filter)
                  } label: {
                    Label(filter.title, systemImage: filter.systemImage)
                  }
                }
              } label: {
                Label(searchState.filter.title, systemImage: "line.3.horizontal.decrease")
              }
              .accessibilityLabel("任务状态筛选：\(searchState.filter.title)")
              .accessibilityIdentifier("torrent-filter-menu")
            }
          }
        }
        .listStyle(.insetGrouped)
        .refreshable {
          await model.refreshTorrents()
        }
      }
    }
  }
}

private struct TorrentOverviewCard: View {
  let downloadSpeed: String
  let uploadSpeed: String
  let taskCount: Int

  var body: some View {
    HStack(spacing: 0) {
      OverviewMetric(title: "下载", value: downloadSpeed, systemImage: "arrow.down", color: .blue)
      Divider().frame(height: 36)
      OverviewMetric(title: "上传", value: uploadSpeed, systemImage: "arrow.up", color: .green)
      Divider().frame(height: 36)
      OverviewMetric(
        title: "任务", value: "\(taskCount)", systemImage: "tray.full", color: .secondary)
    }
    .padding(.vertical, 14)
    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    .padding(.horizontal, 16)
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("torrent-overview")
  }
}

private struct OverviewMetric: View {
  let title: String
  let value: String
  let systemImage: String
  let color: Color

  var body: some View {
    VStack(spacing: 4) {
      Label(title, systemImage: systemImage)
        .font(.caption)
        .foregroundStyle(color)
      Text(value)
        .font(.subheadline.weight(.semibold))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct TorrentRow: View {
  let torrent: TorrentSummary
  let isSelecting: Bool
  let isSelected: Bool

  var body: some View {
    HStack(spacing: 12) {
      if isSelecting {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
          .font(.title3)
          .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
          .accessibilityHidden(true)
      }

      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
          Image(systemName: statusSymbol)
            .foregroundStyle(statusColor)
            .frame(width: 20)

          Text(torrent.name)
            .font(.body.weight(.medium))
            .lineLimit(2)

          Spacer(minLength: 4)

          Text(torrent.progress, format: .percent.precision(.fractionLength(0)))
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.secondary)
        }

        ProgressView(value: torrent.progress)
          .tint(statusColor)

        HStack(spacing: 12) {
          Label(torrent.size, systemImage: "internaldrive")
          Spacer()
          if torrent.status == .downloading {
            Label(torrent.downloadSpeed, systemImage: "arrow.down")
              .foregroundStyle(.blue)
          } else if torrent.status == .seeding {
            Label(torrent.uploadSpeed, systemImage: "arrow.up")
              .foregroundStyle(.green)
          }
          Text(torrent.eta)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      }
    }
    .padding(.vertical, 6)
    .accessibilityElement(children: .combine)
    .accessibilityValue(isSelecting ? (isSelected ? "已选择" : "未选择") : "")
  }

  private var statusColor: Color {
    switch torrent.status {
    case .downloading: .blue
    case .seeding, .completed: .green
    case .paused, .queued: .secondary
    case .error: .red
    }
  }

  private var statusSymbol: String {
    switch torrent.status {
    case .downloading: "arrow.down.circle.fill"
    case .seeding: "arrow.up.circle.fill"
    case .completed: "checkmark.circle.fill"
    case .paused: "pause.circle.fill"
    case .queued: "clock.fill"
    case .error: "exclamationmark.circle.fill"
    }
  }
}
