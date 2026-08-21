import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class MikanSubscriptionsScreenState {
  var errorMessage: String?
  var retryingEpisodeIDs: Set<String> = []
  var successMessage: String?
  var scope: SubscriptionScope = .all
}

final class SubscriptionsViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let baseURL: URL?
  private let onOpenSubscription: (HelperSubscriptionGroup) -> Void
  private let state = MikanSubscriptionsScreenState()

  init(
    model: AppModel,
    baseURL: URL?,
    onOpenSubscription: @escaping (HelperSubscriptionGroup) -> Void
  ) {
    self.model = model
    self.baseURL = baseURL
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
    navigationItem.largeTitleDisplayMode = .always
    host(
      MikanSubscriptionsContentView(
        baseURL: baseURL,
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
    model.startMikanPolling()
    Task { await model.refreshAllHelperSubscriptions() }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    model.stopMikanPolling()
    markSubscriptionSeen()
  }

  private func markSubscriptionSeen() {
    let counts = Dictionary(
      uniqueKeysWithValues: model.helperSubscriptionGroups.map {
        ($0.id, SubscriptionScheduleModel.episodeCount(in: $0))
      }
    )
    model.markSubscriptionsSeen(counts)
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

  private func retryFailures(in group: HelperSubscriptionGroup) {
    for target in group.targets {
      for episode in target.episodes where episode.state.isRetryable {
        retry(serverID: target.serverID, replica: group.replica, episode: episode)
      }
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

  static func retryID(serverID: UUID, episodeID: String) -> String {
    "\(serverID.uuidString):\(episodeID)"
  }
}

private struct MikanSubscriptionsContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanSubscriptionsScreenState.self) private var state

  let baseURL: URL?
  let onEditTargets: (HelperSubscriptionGroup) -> Void
  let onOpenSubscription: (HelperSubscriptionGroup) -> Void
  let onRefresh: () async -> Void
  let onRetry: (UUID, HelperReplica, HelperEpisodeStatus) -> Void
  let onUnsubscribe: (HelperSubscriptionGroup) -> Void

  private static let dayCharacters = ["日", "一", "二", "三", "四", "五", "六"]

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
          snapshotSections
          scheduleSections
          helperStateSections
          backfillSections
        }
        .refreshable { await onRefresh() }
      }
    }
    .accessibilityIdentifier("helper-subscriptions-page")
  }

  private var schedule: SubscriptionSchedule {
    SubscriptionScheduleModel.build(
      groups: model.helperSubscriptionGroups,
      directory: model.mikanDirectory,
      seenCounts: model.subscriptionSeenCounts
    )
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
  private var snapshotSections: some View {
    ForEach(model.helperSubscriptionVisibleServers) { server in
      if case .loaded(_, let status, .cache) = model.helperSubscriptionState(for: server.id) {
        Section {
          Label(snapshotText(for: server.name, status: status), systemImage: "clock")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .accessibilityIdentifier("subscription-snapshot-\(server.id.uuidString)")
        }
      }
    }
  }

  private func snapshotText(for serverName: String, status: HelperRuntimeStatus) -> String {
    let checkedAt = status.replicas.compactMap(\.checkedAt).max()
    if let checkedAt {
      let fragment = MikanSubscriptionBarModel.relativeTimeFragment(
        from: checkedAt,
        now: Date.now
      )
      return "无法连接 \(serverName)，正在显示 \(fragment)的本地快照。"
    }
    return "无法连接 \(serverName)，正在显示本地快照。"
  }

  @ViewBuilder
  private var scheduleSections: some View {
    let schedule = schedule
    if !model.helperSubscriptionGroups.isEmpty {
      Section {
        Text(summaryText(schedule))
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .accessibilityIdentifier("subscription-summary")
        SubscriptionWeekStrip(
          sections: schedule.sections,
          daysWithNewEpisodes: schedule.daysWithNewEpisodes,
          selection: Binding(
            get: { state.scope },
            set: { state.scope = $0 }
          )
        )
        .listRowInsets(EdgeInsets())
      } footer: {
        Text("同一番组与字幕组在多台 Helper 上合并为一个订阅；Helper 仍是各服务器的真相源。")
      }

      switch state.scope {
      case .all:
        ForEach(schedule.sections.filter { !$0.entries.isEmpty }) { section in
          Section(header: Text(Self.header(for: section))) {
            ForEach(section.entries) { entry in
              row(entry, showsWeekday: true)
            }
          }
        }
        if !schedule.unscheduled.isEmpty {
          Section("未定档") {
            ForEach(schedule.unscheduled) { entry in
              row(entry, showsWeekday: false)
            }
          }
        }
      case .day(let weekday):
        let entries = schedule.entries(mikanWeekday: weekday)
        Section(header: Text(Self.header(for: section(for: weekday, in: schedule)))) {
          if entries.isEmpty {
            Text("这一天没有放送更新。")
              .foregroundStyle(.secondary)
              .accessibilityIdentifier("subscription-empty-day")
          }
          ForEach(entries) { entry in
            row(entry, showsWeekday: false)
          }
        }
      }
    }
  }

  private func row(_ entry: SubscriptionScheduleEntry, showsWeekday: Bool) -> some View {
    SubscriptionScheduleRow(
      entry: entry,
      showsWeekday: showsWeekday,
      baseURL: baseURL,
      onOpen: { onOpenSubscription(entry.group) },
      onEditTargets: { onEditTargets(entry.group) },
      onRetryFailures: {
        for target in entry.group.targets {
          for episode in target.episodes where episode.state.isRetryable {
            onRetry(target.serverID, entry.group.replica, episode)
          }
        }
      },
      onUnsubscribe: { onUnsubscribe(entry.group) }
    )
  }

  private func summaryText(_ schedule: SubscriptionSchedule) -> String {
    if schedule.newCount > 0 {
      return "\(schedule.totalCount) 部订阅 · \(schedule.newCount) 部有新集"
    }
    return "\(schedule.totalCount) 部订阅"
  }

  private func section(for weekday: Int, in schedule: SubscriptionSchedule) -> SubscriptionDaySection {
    schedule.sections.first { $0.mikanWeekday == weekday }
      ?? SubscriptionDaySection(
        mikanWeekday: weekday,
        daysFromToday: 0,
        date: .now,
        entries: []
      )
  }

  private static func header(for section: SubscriptionDaySection) -> String {
    let month = Calendar.current.component(.month, from: section.date)
    let day = Calendar.current.component(.day, from: section.date)
    let weekday = "周\(dayCharacters[section.mikanWeekday])"
    switch section.daysFromToday {
    case 0:
      return "今天 · \(month)月\(day)日 \(weekday)"
    case 1:
      return "明天 · \(weekday)"
    default:
      return "\(weekday) · \(month)月\(day)日"
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
