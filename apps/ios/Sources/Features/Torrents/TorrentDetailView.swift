import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class TorrentDetailState {
  var downloadStrategyErrorMessage: String?
  var errorMessage: String?
  var isPerformingAction = false
  var torrent: TorrentSummary

  init(torrent: TorrentSummary) {
    self.torrent = torrent
  }
}

final class TorrentDetailViewController: SwiftUIHostingViewController {
  private let liveActivityCoordinator = TorrentLiveActivityCoordinator.shared
  private let model: AppModel
  private let moreButton = UIBarButtonItem(
    image: UIImage(systemName: "ellipsis"),
    menu: nil
  )
  private let pauseButton = UIBarButtonItem(
    image: UIImage(systemName: "pause.fill"),
    style: .plain,
    target: nil,
    action: nil
  )
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
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.backButtonTitle = "任务"
    view.backgroundColor = .systemGroupedBackground

    pauseButton.target = self
    pauseButton.action = #selector(togglePause)
    pauseButton.accessibilityIdentifier = "torrent-detail-action"

    moreButton.menu = UIMenu(children: [
      UIAction(
        title: "分类、标签与限速",
        image: UIImage(systemName: "slider.horizontal.3")
      ) { [weak self] _ in
        self?.presentManagement()
      },
      UIAction(
        title: "删除任务",
        image: UIImage(systemName: "trash"),
        attributes: .destructive
      ) { [weak self] _ in
        self?.confirmDelete()
      },
    ])
    moreButton.accessibilityIdentifier = "torrent-detail-more"
    navigationItem.rightBarButtonItems = [moreButton, pauseButton]
    updateNavigationItem()

    host(
      TorrentDetailContentView(
        onSetDownloadStrategy: { [weak self] strategy, enabled in
          self?.setDownloadStrategy(strategy, enabled: enabled)
        },
        onOpenInspector: { [weak self] kind in
          self?.showInspector(kind)
        },
        onCopyHash: { [weak self] in
          self?.copyHash()
        },
        onToggleLiveActivity: { [weak self] in
          self?.toggleLiveActivity()
        }
      )
      .environment(state)
      .environment(liveActivityCoordinator)
    )
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    liveActivityCoordinator.refreshStatus()
    if let updated = model.torrents.first(where: { $0.id == state.torrent.id }) {
      state.torrent = updated
    }
    updateNavigationItem()
  }

  @objc private func togglePause() {
    let shouldPause = !state.torrent.isPaused
    state.errorMessage = nil
    state.isPerformingAction = true
    updateNavigationItem()
    Task {
      do {
        state.torrent = try await model.setTorrentPaused(
          torrentID: state.torrent.id,
          paused: shouldPause,
          serverID: serverID
        )
      } catch {
        state.errorMessage = error.localizedDescription
      }
      state.isPerformingAction = false
      updateNavigationItem()
    }
  }

  private func presentManagement() {
    TorrentManagementViewController.present(
      from: self,
      model: model,
      torrent: state.torrent,
      serverID: serverID
    ) { [weak self] updated in
      self?.state.torrent = updated
    }
  }

  private func setDownloadStrategy(
    _ strategy: TorrentDownloadStrategy,
    enabled: Bool
  ) {
    guard enabled != downloadStrategyValue(strategy) else { return }
    let previous = state.torrent
    state.downloadStrategyErrorMessage = nil
    state.errorMessage = nil
    state.isPerformingAction = true
    state.torrent = previous.updatingDownloadStrategy(strategy, enabled: enabled)
    updateNavigationItem()
    Task {
      do {
        state.torrent = try await model.toggleTorrentDownloadStrategy(
          strategy,
          torrentID: previous.id,
          serverID: serverID
        )
      } catch {
        state.torrent = previous
        state.downloadStrategyErrorMessage = error.localizedDescription
      }
      state.isPerformingAction = false
      updateNavigationItem()
    }
  }

  private func downloadStrategyValue(_ strategy: TorrentDownloadStrategy) -> Bool {
    switch strategy {
    case .sequential:
      state.torrent.isSequentialDownloadEnabled
    case .firstLastPiecePriority:
      state.torrent.isFirstLastPiecePriorityEnabled
    }
  }

  private func showInspector(_ kind: TorrentInspectorKind) {
    let controller = TorrentInspectorViewController(
      kind: kind,
      model: model,
      torrentID: state.torrent.id,
      serverID: serverID
    )
    DispatchQueue.main.async { [weak self] in
      self?.navigationController?.pushViewController(controller, animated: true)
    }
  }

  private func copyHash() {
    UIPasteboard.general.string = state.torrent.id
  }

  private func toggleLiveActivity() {
    guard let server = model.servers.first(where: { $0.id == serverID }) else {
      return
    }
    Task {
      if liveActivityCoordinator.activeTorrentID == state.torrent.id {
        await liveActivityCoordinator.stop()
      } else {
        await liveActivityCoordinator.start(torrent: state.torrent, server: server)
      }
    }
  }

  private func confirmDelete() {
    let alert = UIAlertController(
      title: "移除“\(state.torrent.name)”？",
      message: "请选择是否同时删除服务器上的已下载文件。此操作无法撤销。",
      preferredStyle: .actionSheet
    )
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(
      UIAlertAction(title: "仅移除任务，保留文件", style: .default) { [weak self] _ in
        self?.deleteTorrent(deleteFiles: false)
      })
    alert.addAction(
      UIAlertAction(title: "移除任务并删除文件", style: .destructive) { [weak self] _ in
        self?.deleteTorrent(deleteFiles: true)
      })
    alert.popoverPresentationController?.barButtonItem = moreButton
    present(alert, animated: true)
  }

  private func deleteTorrent(deleteFiles: Bool) {
    state.isPerformingAction = true
    state.errorMessage = nil
    updateNavigationItem()
    Task {
      do {
        try await model.deleteTorrents(
          torrentIDs: [state.torrent.id],
          deleteFiles: deleteFiles,
          serverID: serverID
        )
        navigationController?.popViewController(animated: true)
      } catch {
        state.isPerformingAction = false
        state.errorMessage = error.localizedDescription
        updateNavigationItem()
      }
    }
  }

  private func updateNavigationItem() {
    title = state.torrent.name
    pauseButton.image = UIImage(
      systemName: state.torrent.isPaused ? "play.fill" : "pause.fill"
    )
    pauseButton.accessibilityLabel = state.torrent.isPaused ? "继续任务" : "暂停任务"
    pauseButton.isEnabled = !state.isPerformingAction
  }
}

private struct TorrentDetailContentView: View {
  @Environment(TorrentLiveActivityCoordinator.self) private var liveActivityCoordinator
  @Environment(TorrentDetailState.self) private var state

  let onSetDownloadStrategy: (TorrentDownloadStrategy, Bool) -> Void
  let onOpenInspector: (TorrentInspectorKind) -> Void
  let onCopyHash: () -> Void
  let onToggleLiveActivity: () -> Void

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: AppSpacing.group) {
          Text(state.torrent.name)
            .font(.body.weight(.semibold))
            .textSelection(.enabled)
            .accessibilityIdentifier("torrent-detail-title")

          VStack(alignment: .leading, spacing: AppSpacing.related) {
            HStack(alignment: .firstTextBaseline) {
              Label(state.torrent.statusTitle, systemImage: statusSymbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(statusColor)
                .accessibilityIdentifier("torrent-detail-status")
              Spacer(minLength: AppSpacing.related)
              Text(state.torrent.progress, format: .percent.precision(.fractionLength(0)))
                .font(.title3.monospacedDigit().weight(.semibold))
            }
            ProgressView(value: state.torrent.progress)
              .tint(statusColor)
            CompactMetricStrip(items: transferMetrics)
              .font(.caption.monospacedDigit())
          }
        }
      } footer: {
        if let errorMessage = state.errorMessage {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-detail-error")
        }
      }

      Section("传输") {
        LabeledContent("大小", value: state.torrent.size)
        LabeledContent("分享率", value: String(format: "%.2f", state.torrent.shareRatio))
        LabeledContent(
          "下载限速",
          value: TorrentInput.formattedSpeedLimit(state.torrent.downloadLimit)
        )
        LabeledContent(
          "上传限速",
          value: TorrentInput.formattedSpeedLimit(state.torrent.uploadLimit)
        )
      }

      Section {
        Button(action: onToggleLiveActivity) {
          Label(liveActivityButtonTitle, systemImage: liveActivityButtonSymbol)
        }
        .disabled(
          state.isPerformingAction
            || liveActivityCoordinator.isPerformingAction
            || state.torrent.status == .completed
            || state.torrent.progress >= 1
        )
        .accessibilityIdentifier("torrent-detail-live-activity")

        LabeledContent("状态") {
          Text(liveActivityCoordinator.statusText(for: state.torrent))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.trailing)
            .accessibilityIdentifier("torrent-detail-live-activity-status")
        }
      } header: {
        Text("实时活动")
      } footer: {
        if let errorMessage = liveActivityCoordinator.errorMessage {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-detail-live-activity-error")
        } else {
          Text("同一时间跟踪一个任务；刷新任务时同步进度，完成后由系统自动收起。")
        }
      }

      Section {
        ForEach(TorrentInspectorKind.allCases) { kind in
          Button {
            onOpenInspector(kind)
          } label: {
            HStack {
              Text(kind.title)
                .foregroundStyle(.primary)
              Spacer()
              Image(systemName: "chevron.forward")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
            }
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("torrent-detail-\(kind.rawValue)")
        }
      } header: {
        Text("检查")
      } footer: {
        Text("查看逐文件进度、Tracker 与 Peer。")
      }

      Section {
        Toggle(
          isOn: downloadStrategyBinding(.sequential),
          label: {
            strategyLabel(
              title: "顺序下载",
              subtitle: "按分片顺序请求，适合边下边看"
            )
          }
        )
        .disabled(state.isPerformingAction)
        .accessibilityIdentifier("torrent-detail-sequential-download")

        Toggle(
          isOn: downloadStrategyBinding(.firstLastPiecePriority),
          label: {
            strategyLabel(
              title: "首尾分片优先",
              subtitle: "优先完成每个文件的首尾分片"
            )
          }
        )
        .disabled(state.isPerformingAction)
        .accessibilityIdentifier("torrent-detail-first-last-piece")
      } header: {
        Text("下载策略")
      } footer: {
        if let errorMessage = state.downloadStrategyErrorMessage {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-detail-strategy-error")
        }
      }

      Section("位置与标识") {
        detailRow(title: "保存路径", value: state.torrent.savePath)
        LabeledContent("分类", value: state.torrent.category ?? "无")
        detailRow(
          title: "标签",
          value: state.torrent.tags.isEmpty ? "无" : state.torrent.tags.joined(separator: "、")
        )
        hashRow
        LabeledContent("添加时间", value: formatted(state.torrent.addedAt))
        LabeledContent("完成时间", value: formatted(state.torrent.completedAt))
      }
    }
    .accessibilityIdentifier("torrent-detail-page")
  }

  private var hashRow: some View {
    HStack(alignment: .firstTextBaseline, spacing: AppSpacing.related) {
      VStack(alignment: .leading, spacing: AppSpacing.atomic) {
        Text("哈希")
          .font(.caption)
          .foregroundStyle(.secondary)
        Text(state.torrent.id)
          .font(.footnote.monospaced())
          .textSelection(.enabled)
      }
      Spacer(minLength: AppSpacing.related)
      Button("拷贝", action: onCopyHash)
        .accessibilityIdentifier("torrent-detail-copy-hash")
    }
  }

  private var liveActivityButtonSymbol: String {
    liveActivityCoordinator.activeTorrentID == state.torrent.id
      ? "stop.circle"
      : "waveform.path.ecg"
  }

  private var liveActivityButtonTitle: String {
    liveActivityCoordinator.activeTorrentID == state.torrent.id
      ? "停止实时活动"
      : "在锁屏与灵动岛跟踪"
  }

  private var transferMetrics: [CompactMetricItem] {
    [
      CompactMetricItem(
        accessibilityTitle: "下载速度",
        id: "detail-download-speed",
        systemImage: "arrow.down",
        value: state.torrent.downloadSpeed,
        color: .blue
      ),
      CompactMetricItem(
        accessibilityTitle: "上传速度",
        id: "detail-upload-speed",
        systemImage: "arrow.up",
        value: state.torrent.uploadSpeed,
        color: .green
      ),
      CompactMetricItem(
        accessibilityTitle: "剩余时间",
        id: "detail-eta",
        systemImage: "clock",
        value: state.torrent.eta
      ),
    ]
  }

  private func detailRow(title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: AppSpacing.atomic) {
      Text(title)
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(value)
        .font(.body)
        .textSelection(.enabled)
    }
  }

  private func downloadStrategyBinding(
    _ strategy: TorrentDownloadStrategy
  ) -> Binding<Bool> {
    Binding(
      get: {
        switch strategy {
        case .sequential: state.torrent.isSequentialDownloadEnabled
        case .firstLastPiecePriority: state.torrent.isFirstLastPiecePriorityEnabled
        }
      },
      set: { enabled in
        onSetDownloadStrategy(strategy, enabled)
      }
    )
  }

  private func strategyLabel(title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: AppSpacing.atomic) {
      Text(title)
      Text(subtitle)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
  }

  private func formatted(_ date: Date?) -> String {
    date?.formatted(date: .abbreviated, time: .shortened) ?? "—"
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
