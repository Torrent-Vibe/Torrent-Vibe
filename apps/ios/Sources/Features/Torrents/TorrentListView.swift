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

final class TorrentViewController: SwiftUIHostingViewController, UISearchResultsUpdating {
  var onOpenServers: (() -> Void)?

  private let model: AppModel
  private let searchState = TorrentSearchState()
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
        onTogglePause: { [weak self] torrent in
          self?.togglePause(for: torrent)
        }
      )
      .environment(model)
      .environment(searchState)
    )

    configureSearchController()
    addButton.accessibilityLabel = "添加 Torrent"
    addButton.accessibilityIdentifier = "torrent-add"
    refreshButton.accessibilityLabel = "刷新任务"
    refreshButton.accessibilityIdentifier = "torrent-refresh"
    navigationItem.rightBarButtonItems = [addButton, refreshButton]
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
  }
}

private struct TorrentContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentSearchState.self) private var searchState

  let onOpenServers: () -> Void
  let onOpenTorrent: (TorrentSummary) -> Void
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
                  onOpenTorrent(torrent)
                } label: {
                  TorrentRow(torrent: torrent)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("torrent-row-\(torrent.id)")
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
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

  var body: some View {
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
    .padding(.vertical, 6)
    .accessibilityElement(children: .combine)
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

@MainActor
@Observable
private final class TorrentDetailState {
  var errorMessage: String?
  var isPerformingAction = false
  var notice: String?
  var torrent: TorrentSummary

  init(torrent: TorrentSummary) {
    self.torrent = torrent
  }
}

private final class TorrentDetailViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let serverID: UUID
  private let state: TorrentDetailState

  init(model: AppModel, torrent: TorrentSummary, serverID: UUID) {
    self.model = model
    self.serverID = serverID
    state = TorrentDetailState(torrent: torrent)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "任务详情"
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(
      TorrentDetailContentView { [weak self] in
        self?.togglePause()
      }
      .environment(state)
    )
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    if let updated = model.torrents.first(where: { $0.id == state.torrent.id }) {
      state.torrent = updated
    }
  }

  private func togglePause() {
    let shouldPause = !state.torrent.isPaused
    state.errorMessage = nil
    state.notice = nil
    state.isPerformingAction = true
    Task {
      do {
        state.torrent = try await model.setTorrentPaused(
          torrentID: state.torrent.id,
          paused: shouldPause,
          serverID: serverID
        )
        state.notice = shouldPause ? "任务已暂停" : "任务已继续"
      } catch {
        state.errorMessage = error.localizedDescription
      }
      state.isPerformingAction = false
    }
  }
}

private struct TorrentDetailContentView: View {
  @Environment(TorrentDetailState.self) private var state

  let onTogglePause: () -> Void

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Text(state.torrent.name)
            .font(.title2.weight(.bold))
            .accessibilityIdentifier("torrent-detail-title")

          HStack {
            Label(state.torrent.statusTitle, systemImage: statusSymbol)
              .foregroundStyle(statusColor)
              .accessibilityIdentifier("torrent-detail-status")
            Spacer()
            Text(state.torrent.progress, format: .percent.precision(.fractionLength(0)))
              .font(.headline.monospacedDigit())
          }
          ProgressView(value: state.torrent.progress)
            .tint(statusColor)
        }
        .padding(.vertical, 6)
      }

      if let notice = state.notice {
        Section {
          Label(notice, systemImage: "checkmark.circle.fill")
            .foregroundStyle(.green)
            .accessibilityIdentifier("torrent-detail-notice")
        }
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-detail-error")
        }
      }

      Section {
        Button(action: onTogglePause) {
          if state.isPerformingAction {
            ProgressView()
              .frame(maxWidth: .infinity)
          } else {
            Label(
              state.torrent.isPaused ? "继续任务" : "暂停任务",
              systemImage: state.torrent.isPaused ? "play.fill" : "pause.fill"
            )
            .frame(maxWidth: .infinity)
          }
        }
        .buttonStyle(.borderedProminent)
        .disabled(state.isPerformingAction)
        .accessibilityIdentifier("torrent-detail-action")
      }
      .listRowBackground(Color.clear)

      Section("传输") {
        LabeledContent("下载速度", value: state.torrent.downloadSpeed)
        LabeledContent("上传速度", value: state.torrent.uploadSpeed)
        LabeledContent("ETA", value: state.torrent.eta)
        LabeledContent("分享率", value: String(format: "%.2f", state.torrent.shareRatio))
        LabeledContent("总大小", value: state.torrent.size)
      }

      Section("位置与标识") {
        detailRow(title: "保存路径", value: state.torrent.savePath)
        LabeledContent("分类", value: state.torrent.category ?? "无")
        detailRow(
          title: "标签",
          value: state.torrent.tags.isEmpty ? "无" : state.torrent.tags.joined(separator: "、")
        )
        detailRow(title: "哈希", value: state.torrent.id, monospaced: true)
        if let addedAt = state.torrent.addedAt {
          LabeledContent("添加时间", value: formatted(addedAt))
        }
        if let completedAt = state.torrent.completedAt {
          LabeledContent("完成时间", value: formatted(completedAt))
        }
      }
    }
    .accessibilityIdentifier("torrent-detail-page")
  }

  private func detailRow(
    title: String,
    value: String,
    monospaced: Bool = false
  ) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(title)
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(value)
        .font(monospaced ? .footnote.monospaced() : .body)
        .textSelection(.enabled)
    }
  }

  private func formatted(_ date: Date) -> String {
    date.formatted(date: .abbreviated, time: .shortened)
  }

  private var statusColor: Color {
    switch state.torrent.status {
    case .downloading: .blue
    case .seeding, .completed: .green
    case .paused, .queued: .secondary
    case .error: .red
    }
  }

  private var statusSymbol: String {
    switch state.torrent.status {
    case .downloading: "arrow.down.circle.fill"
    case .seeding: "arrow.up.circle.fill"
    case .completed: "checkmark.circle.fill"
    case .paused: "pause.circle.fill"
    case .queued: "clock.fill"
    case .error: "exclamationmark.circle.fill"
    }
  }
}
