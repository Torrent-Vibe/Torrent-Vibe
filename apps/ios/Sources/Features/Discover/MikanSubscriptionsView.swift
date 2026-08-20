import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class MikanSubscriptionsScreenState {
  var errorMessage: String?
  var retryingEpisodeIDs: Set<String> = []
  var successMessage: String?
}

final class SubscriptionsViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let onOpenSubscription: (HelperSubscriptionGroup) -> Void
  private let state = MikanSubscriptionsScreenState()

  init(
    model: AppModel,
    onOpenSubscription: @escaping (HelperSubscriptionGroup) -> Void
  ) {
    self.model = model
    self.onOpenSubscription = onOpenSubscription
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "我的订阅"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      MikanSubscriptionsContentView(
        onEditTargets: { [weak self] group in
          self?.showTargetEditor(for: group)
        },
        onOpenSubscription: { [weak self] group in
          self?.onOpenSubscription(group)
        },
        onRefresh: { [weak self] in
          await self?.model.refreshAllHelperSubscriptions()
        },
        onRetry: { [weak self] serverID, replica, episode in
          self?.retry(serverID: serverID, replica: replica, episode: episode)
        },
        onUnsubscribe: { [weak self] group in
          self?.confirmUnsubscribe(group)
        }
      )
      .environment(model)
      .environment(state)
    )
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    Task { await model.refreshAllHelperSubscriptions() }
  }

  private func showTargetEditor(for group: HelperSubscriptionGroup) {
    MikanSubscriptionTargetsViewController.present(
      from: self,
      model: model,
      group: group
    ) { [weak self] outcome in
      let targets = outcome.serverNames.joined(separator: "、")
      self?.state.errorMessage = nil
      self?.state.successMessage = "已更新订阅目标：\(targets)"
    }
  }

  private func retry(
    serverID: UUID,
    replica: HelperReplica,
    episode: HelperEpisodeStatus
  ) {
    let retryID = Self.retryID(serverID: serverID, episodeID: episode.episodeId)
    state.retryingEpisodeIDs.insert(retryID)
    state.errorMessage = nil
    Task {
      do {
        try await model.retryHelperEpisode(
          serverID: serverID,
          bangumiID: replica.bangumiId,
          subgroupID: replica.subgroupId,
          episode: episode
        )
      } catch {
        state.errorMessage = error.localizedDescription
      }
      state.retryingEpisodeIDs.remove(retryID)
    }
  }

  private func confirmUnsubscribe(_ group: HelperSubscriptionGroup) {
    let targets = group.targets.map(\.serverName).joined(separator: "、")
    let alert = UIAlertController(
      title: "取消《\(group.replica.title)》订阅？",
      message: "将从 \(targets) 的 Helper 移除此订阅；已经添加的 Torrent 与文件会保留。",
      preferredStyle: .actionSheet
    )
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(
      UIAlertAction(title: "取消订阅", style: .destructive) { [weak self] _ in
        self?.unsubscribe(group)
      }
    )
    present(alert, animated: true)
  }

  private func unsubscribe(_ group: HelperSubscriptionGroup) {
    state.errorMessage = nil
    state.successMessage = nil
    Task {
      do {
        try await model.unsubscribeMikanSubscription(group)
      } catch {
        state.errorMessage = error.localizedDescription
      }
    }
  }

  fileprivate static func retryID(serverID: UUID, episodeID: String) -> String {
    "\(serverID.uuidString):\(episodeID)"
  }
}

private struct MikanSubscriptionsContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanSubscriptionsScreenState.self) private var state

  let onEditTargets: (HelperSubscriptionGroup) -> Void
  let onOpenSubscription: (HelperSubscriptionGroup) -> Void
  let onRefresh: () async -> Void
  let onRetry: (UUID, HelperReplica, HelperEpisodeStatus) -> Void
  let onUnsubscribe: (HelperSubscriptionGroup) -> Void

  var body: some View {
    Group {
      if model.helperSubscriptionVisibleServers.isEmpty {
        ContentUnavailableView {
          Label("尚未配对 Helper", systemImage: "bookmark")
        } description: {
          Text("前往设置中的服务器详情完成 Helper 配对后，可在这里管理持续订阅。")
        }
      } else {
        List {
          feedbackSections
          subscriptionSection
          helperStateSections
          backfillSections
        }
        .refreshable { await onRefresh() }
      }
    }
    .accessibilityIdentifier("helper-subscriptions-page")
  }

  @ViewBuilder
  private var feedbackSections: some View {
    if let successMessage = state.successMessage {
      Section {
        Label(successMessage, systemImage: "checkmark.circle.fill")
          .foregroundStyle(.green)
          .accessibilityIdentifier("helper-subscriptions-success")
      }
    }
    if let errorMessage = state.errorMessage {
      Section {
        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
          .foregroundStyle(.red)
          .accessibilityIdentifier("helper-subscriptions-error")
      }
    }
  }

  @ViewBuilder
  private var subscriptionSection: some View {
    if !model.helperSubscriptionGroups.isEmpty {
      Section {
        ForEach(model.helperSubscriptionGroups) { group in
          subscriptionRow(group)
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
              Button("取消订阅", role: .destructive) {
                onUnsubscribe(group)
              }
            }
        }
      } header: {
        Text("持续订阅")
      } footer: {
        Text("同一番组与字幕组在多台 Helper 上合并为一个订阅；Helper 仍是各服务器的真相源。")
      }
    }
  }

  @ViewBuilder
  private var helperStateSections: some View {
    ForEach(model.helperSubscriptionVisibleServers) { server in
      switch model.helperSubscriptionState(for: server.id) {
      case .idle, .loading:
        if model.helperSubscriptionGroups.isEmpty {
          Section {
            HStack {
              ProgressView()
              Text("正在读取 \(server.name) 的 Helper 真相源")
                .foregroundStyle(.secondary)
            }
          }
        }
      case .failed(let message):
        Section {
          ContentUnavailableView {
            Label("无法读取 \(server.name)", systemImage: "exclamationmark.triangle")
          } description: {
            Text(message)
          } actions: {
            Button("重试") {
              Task { await model.refreshHelperSubscriptions(for: server.id) }
            }
          }
        }
      case .loaded(let snapshot, _, _):
        if snapshot.replicas.isEmpty, model.helperSubscriptionGroups.isEmpty {
          Section {
            Text("\(server.name) 暂无持续订阅。")
              .foregroundStyle(.secondary)
          }
        }
      case .needsRepairing:
        Section {
          ContentUnavailableView {
            Label("需要重新配对 \(server.name)", systemImage: "exclamationmark.triangle")
          } description: {
            Text("配对信息已失效，请在服务器设置中重新配对 Helper。")
          }
        }
      }
    }
  }

  @ViewBuilder
  private var backfillSections: some View {
    ForEach(model.pairedHelperServers) { server in
      if case .loaded(_, let status, _) = model.helperSubscriptionState(for: server.id),
        !status.jobs.isEmpty
      {
        Section("\(server.name) · 一次性导入") {
          ForEach(status.jobs) { job in
            jobRow(serverID: server.id, job: job)
          }
        }
      }
    }
  }

  private func subscriptionRow(_ group: HelperSubscriptionGroup) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 12) {
        Button {
          onOpenSubscription(group)
        } label: {
          VStack(alignment: .leading, spacing: 5) {
            Text(group.replica.title)
              .font(.headline)
            Label(group.replica.subgroupName, systemImage: "person.2")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("helper-subscription-open-\(group.accessibilityID)")

        Button {
          onEditTargets(group)
        } label: {
          Image(systemName: "ellipsis.circle")
            .font(.body)
            .frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("编辑目标服务器")
        .accessibilityIdentifier("helper-subscription-edit-target-\(group.accessibilityID)")
      }

      Label(group.targets.map(\.serverName).joined(separator: "、"), systemImage: "server.rack")
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .accessibilityIdentifier("helper-subscription-targets-\(group.accessibilityID)")

      ForEach(group.targets) { target in
        targetStatusRow(group: group, target: target)
      }
    }
    .padding(.vertical, 4)
  }

  private func targetStatusRow(
    group: HelperSubscriptionGroup,
    target: HelperSubscriptionTarget
  ) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(target.serverName)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      if let episode = target.episodes.first {
        HStack(alignment: .firstTextBaseline) {
          Text(episode.title)
            .font(.caption)
            .lineLimit(2)
          Spacer()
          Text(episode.state.title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(episode.state.isRetryable ? .red : .secondary)
        }
        if let lastError = episode.lastError {
          Text(lastError)
            .font(.caption2)
            .foregroundStyle(.red)
        }
        if episode.state.isRetryable {
          retryButton(
            serverID: target.serverID,
            replica: group.replica,
            episode: episode
          )
        }
      } else {
        Label("等待 Helper 拉取更新", systemImage: "clock")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }

  private func retryButton(
    serverID: UUID,
    replica: HelperReplica,
    episode: HelperEpisodeStatus
  ) -> some View {
    let retryID = SubscriptionsViewController.retryID(
      serverID: serverID,
      episodeID: episode.episodeId
    )
    return Button {
      onRetry(serverID, replica, episode)
    } label: {
      if state.retryingEpisodeIDs.contains(retryID) {
        ProgressView()
      } else {
        Label("重试", systemImage: "arrow.clockwise")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.regular)
    .disabled(state.retryingEpisodeIDs.contains(retryID))
    .accessibilityIdentifier("helper-episode-retry-\(serverID.uuidString)-\(episode.episodeId)")
  }

  private func jobRow(serverID: UUID, job: HelperJobStatus) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("番组 \(job.bangumiId) · 字幕组 \(job.subgroupId)")
        .font(.subheadline)
      Text("\(job.episodes.count) 个剧集 · \(job.episodes.first?.state.title ?? "等待处理")")
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .accessibilityIdentifier("helper-backfill-job-\(serverID.uuidString)-\(job.id)")
  }
}

@MainActor
@Observable
private final class MikanSubscriptionTargetsState {
  var errorMessage: String?
  var isSaving = false
  var selectedServerIDs: Set<UUID>

  init(selectedServerIDs: Set<UUID>) {
    self.selectedServerIDs = selectedServerIDs
  }
}

final class MikanSubscriptionTargetsViewController: SwiftUIHostingViewController {
  private let group: HelperSubscriptionGroup
  private let model: AppModel
  private let onCompletion: (HelperSubscriptionOutcome) -> Void
  private let state: MikanSubscriptionTargetsState

  init(
    model: AppModel,
    group: HelperSubscriptionGroup,
    onCompletion: @escaping (HelperSubscriptionOutcome) -> Void
  ) {
    self.model = model
    self.group = group
    self.onCompletion = onCompletion
    state = MikanSubscriptionTargetsState(selectedServerIDs: group.targetServerIDs)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "订阅目标"
    view.backgroundColor = .systemGroupedBackground
    view.accessibilityIdentifier = "helper-targets-sheet"
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      title: "取消",
      style: .plain,
      target: self,
      action: #selector(cancel)
    )
    navigationItem.leftBarButtonItem?.accessibilityIdentifier = "helper-targets-cancel"
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "保存",
      style: .prominent,
      target: self,
      action: #selector(save)
    )
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "helper-targets-confirm"
    host(
      MikanSubscriptionTargetsContentView(group: group)
        .environment(model)
        .environment(state)
    )
  }

  static func present(
    from presenter: UIViewController,
    model: AppModel,
    group: HelperSubscriptionGroup,
    onCompletion: @escaping (HelperSubscriptionOutcome) -> Void
  ) {
    let controller = MikanSubscriptionTargetsViewController(
      model: model,
      group: group,
      onCompletion: onCompletion
    )
    let navigationController = UINavigationController(rootViewController: controller)
    navigationController.modalPresentationStyle = .pageSheet
    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.prefersGrabberVisible = true
    }
    presenter.present(navigationController, animated: true)
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  @objc private func save() {
    guard !state.selectedServerIDs.isEmpty else {
      state.errorMessage = "请至少保留一个目标服务器。"
      return
    }
    state.errorMessage = nil
    state.isSaving = true
    navigationItem.rightBarButtonItem?.isEnabled = false
    Task {
      do {
        let outcome = try await model.updateMikanSubscriptionTargets(
          group: group,
          targetServerIDs: state.selectedServerIDs
        )
        dismiss(animated: true) { [onCompletion] in
          onCompletion(outcome)
        }
      } catch {
        state.errorMessage = error.localizedDescription
        state.isSaving = false
        navigationItem.rightBarButtonItem?.isEnabled = true
      }
    }
  }
}

private struct MikanSubscriptionTargetsContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanSubscriptionTargetsState.self) private var state

  let group: HelperSubscriptionGroup

  var body: some View {
    List {
      Section {
        ForEach(model.pairedHelperServers) { server in
          Button {
            toggle(server.id)
          } label: {
            HStack(spacing: 12) {
              Image(systemName: "server.rack")
                .foregroundStyle(.secondary)
              VStack(alignment: .leading, spacing: 3) {
                Text(server.name)
                  .foregroundStyle(.primary)
                Text(server.helperBaseURL?.host() ?? "Helper")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              Spacer()
              if state.selectedServerIDs.contains(server.id) {
                Image(systemName: "checkmark")
                  .fontWeight(.semibold)
                  .foregroundStyle(.tint)
              }
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityValue(
            state.selectedServerIDs.contains(server.id) ? "已选择" : "未选择"
          )
          .accessibilityIdentifier("helper-target-toggle-\(server.id.uuidString)")
        }
      } header: {
        Text(group.replica.title)
      } footer: {
        Text("保存时先添加新目标，再移除未选择目标；每台 Helper 均以自身最新 revision 合并。")
      }

      if state.isSaving {
        Section {
          HStack {
            ProgressView()
            Text("正在更新 Helper")
          }
        }
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("helper-targets-error")
        }
      }
    }
  }

  private func toggle(_ serverID: UUID) {
    if state.selectedServerIDs.contains(serverID) {
      state.selectedServerIDs.remove(serverID)
    } else {
      state.selectedServerIDs.insert(serverID)
    }
    state.errorMessage = nil
  }
}
