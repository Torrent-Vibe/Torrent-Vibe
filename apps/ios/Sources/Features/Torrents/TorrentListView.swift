import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class TorrentSearchState {
  var query = ""
}

final class TorrentViewController: SwiftUIHostingViewController, UISearchResultsUpdating {
  var onOpenServers: (() -> Void)?

  private let model: AppModel
  private let searchState = TorrentSearchState()
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

    host(
      TorrentContentView { [weak self] in
        self?.onOpenServers?()
      }
      .environment(model)
      .environment(searchState)
    )

    configureSearchController()
    refreshButton.accessibilityLabel = "刷新任务"
    refreshButton.accessibilityIdentifier = "torrent-refresh"
    navigationItem.rightBarButtonItem = refreshButton
    updateServerMenu()

    Task { await refresh() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    updateServerMenu()
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
    refreshButton.isEnabled = true
  }

  @objc private func refreshTorrents() {
    Task { await refresh() }
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

  private var filteredTorrents: [TorrentSummary] {
    guard !searchState.query.isEmpty else { return model.torrents }
    return model.torrents.filter {
      $0.name.localizedCaseInsensitiveContains(searchState.query)
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
      } else if filteredTorrents.isEmpty {
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
            ForEach(filteredTorrents) { torrent in
              TorrentRow(torrent: torrent)
            }
          } header: {
            Label(
              "\(model.activeServer?.name ?? "当前服务器") · 下载任务",
              systemImage: "externaldrive"
            )
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
      OverviewMetric(title: "任务", value: "\(taskCount)", systemImage: "tray.full", color: .secondary)
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
    .accessibilityIdentifier("torrent-row-\(torrent.id)")
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
