import IslandToast
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class MikanDetailState {
  var detail: MikanBangumiDetail?
  var errorMessage: String?
  var isLoading = true
  var isUnsubscribing = false
  var retryingEpisodeIDs: Set<String> = []
  var selectedSubgroupID: String?
}

final class MikanDetailViewController: SwiftUIHostingViewController {
  private let card: MikanBangumiCard
  private let baseURL: URL
  private let runtime: MikanJavaScriptRuntime
  private let contentService: MikanContentService?
  private let isDemoMode: Bool
  private let model: AppModel
  private let initialSubgroupID: String?
  private let state = MikanDetailState()

  init(
    card: MikanBangumiCard,
    baseURL: URL,
    runtime: MikanJavaScriptRuntime,
    contentService: MikanContentService?,
    isDemoMode: Bool,
    model: AppModel,
    initialSubgroupID: String?
  ) {
    self.card = card
    self.baseURL = baseURL
    self.runtime = runtime
    self.contentService = contentService
    self.isDemoMode = isDemoMode
    self.model = model
    self.initialSubgroupID = initialSubgroupID
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = card.title
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    configureNavigationBar()
    host(
      MikanDetailContentView(
        card: card,
        baseURL: baseURL,
        onImportEpisode: { [weak self] episode in
          self?.showImport(for: episode)
        },
        onRetryEpisode: { [weak self] subgroupID, episode in
          self?.retryEpisode(subgroupID: subgroupID, episode: episode)
        }
      )
      .environment(model)
      .environment(state)
    )
    observeNavigationActions()
    Task { await loadDetail() }
  }

  private func configureNavigationBar() {
    let scrollEdge = UINavigationBarAppearance()
    scrollEdge.configureWithTransparentBackground()
    scrollEdge.shadowColor = .clear
    let standard = UINavigationBarAppearance()
    standard.configureWithDefaultBackground()
    navigationItem.scrollEdgeAppearance = scrollEdge
    navigationItem.compactScrollEdgeAppearance = scrollEdge
    navigationItem.standardAppearance = standard
  }

  private func observeNavigationActions() {
    withObservationTracking {
      updateNavigationActions()
    } onChange: { [weak self] in
      Task { @MainActor in
        self?.observeNavigationActions()
      }
    }
  }

  private func updateNavigationActions() {
    guard let detail = state.detail, let subgroup = actionSubgroup(in: detail) else {
      navigationItem.rightBarButtonItems = nil
      return
    }

    let subscription = model.helperSubscriptionGroup(
      bangumiID: detail.bangumiId,
      subgroupID: subgroup.id
    )
    let hasHelper = !model.pairedHelperServers.isEmpty

    if let subscription {
      let more = UIBarButtonItem(
        image: UIImage(systemName: "ellipsis"),
        menu: UIMenu(children: [
          UIAction(
            title: "编辑目标",
            image: UIImage(systemName: "slider.horizontal.3"),
            attributes: state.isUnsubscribing ? [.disabled] : []
          ) { [weak self] _ in
            self?.showTargetEditor(for: subscription)
          },
          UIAction(
            title: "取消订阅",
            image: UIImage(systemName: "bookmark.slash"),
            attributes: state.isUnsubscribing ? [.disabled] : [.destructive]
          ) { [weak self] _ in
            self?.confirmUnsubscribe(subscription)
          },
        ])
      )
      more.accessibilityLabel = "更多操作"
      more.accessibilityIdentifier = "mikan-detail-more"
      navigationItem.rightBarButtonItems = [more]
    } else {
      let subscribe = UIBarButtonItem(
        image: UIImage(systemName: "plus"),
        style: .prominent,
        target: self,
        action: #selector(subscribeFromNavigation)
      )
      subscribe.isEnabled = hasHelper && !state.isUnsubscribing
      subscribe.accessibilityLabel = "订阅"
      subscribe.accessibilityIdentifier = "mikan-detail-subscribe"
      navigationItem.rightBarButtonItems = [subscribe]
    }
  }

  @objc private func subscribeFromNavigation() {
    guard let detail = state.detail, let subgroup = actionSubgroup(in: detail) else { return }
    showHelperAction(subgroup: subgroup)
  }

  private func actionSubgroup(in detail: MikanBangumiDetail) -> MikanSubgroup? {
    if let selected = state.selectedSubgroupID {
      return detail.subgroups.first { $0.id == selected }
    }
    return detail.subgroups.first
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    model.startMikanPolling()
    Task { await model.refreshAllHelperSubscriptions() }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    model.stopMikanPolling()
  }

  private func showImport(for episode: MikanEpisode) {
    guard model.activeServer != nil else { return }
    TorrentImportViewController.present(
      from: self,
      model: model,
      draft: TorrentImportDraft(
        displayTitle: episode.title,
        locksSource: true,
        sourceText: episode.torrentUrl
      )
    ) { [weak self] server in
      guard let self else { return }
      TorrentImportViewController.presentSuccess(on: self, server: server)
    }
  }

  private func retryEpisode(subgroupID: String, episode: HelperEpisodeStatus) {
    guard let detail = state.detail,
      let group = model.helperSubscriptionGroup(bangumiID: detail.bangumiId, subgroupID: subgroupID),
      let target = group.targets.first(where: { $0.serverID == model.activeServerID })
        ?? group.targets.first
    else { return }

    let retryID = Self.retryID(subgroupID: subgroupID, episodeID: episode.episodeId)
    state.retryingEpisodeIDs.insert(retryID)
    Task {
      defer { state.retryingEpisodeIDs.remove(retryID) }
      do {
        try await model.retryHelperEpisode(
          serverID: target.serverID,
          bangumiID: detail.bangumiId,
          subgroupID: subgroupID,
          episode: episode
        )
        IslandToast.show("已重新提交", from: self)
      } catch {
        let alert = UIAlertController(
          title: "无法重试",
          message: error.localizedDescription,
          preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
      }
    }
  }

  static func retryID(subgroupID: String, episodeID: String) -> String {
    "\(subgroupID):\(episodeID)"
  }

  private func showHelperAction(subgroup: MikanSubgroup) {
    guard let detail = state.detail else { return }
    MikanHelperActionViewController.present(
      from: self,
      baseURL: baseURL,
      detail: detail,
      subgroup: subgroup,
      model: model
    ) { [weak self] outcome in
      self?.presentHelperSuccess(outcome)
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
    state.isUnsubscribing = true
    Task {
      defer { state.isUnsubscribing = false }
      do {
        try await model.unsubscribeMikanSubscription(group)
        IslandToast.show("已取消订阅", from: self)
      } catch {
        let alert = UIAlertController(
          title: "无法取消订阅",
          message: error.localizedDescription,
          preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
      }
    }
  }

  private func showTargetEditor(for group: HelperSubscriptionGroup) {
    MikanSubscriptionTargetsViewController.present(
      from: self,
      model: model,
      group: group
    ) { [weak self] outcome in
      guard let self else { return }
      IslandToast.show("已更新订阅目标 · \(outcome.serverNames.joined(separator: "、"))", from: self)
    }
  }

  private func presentHelperSuccess(_ outcome: HelperSubscriptionOutcome) {
    let names = outcome.serverNames.joined(separator: "、")
    let message =
      if outcome.backfillFailed {
        "已订阅，但导入已出剧集失败 · \(names)"
      } else if outcome.mergedConflict {
        "已合并订阅 · \(names)"
      } else {
        "已订阅 · \(names)"
      }
    IslandToast.show(message, from: self)
  }

  private func loadDetail() async {
    state.isLoading = true
    state.errorMessage = nil
    defer { state.isLoading = false }

    do {
      let detail: MikanBangumiDetail
      if isDemoMode {
        detail = try await runtime.parseBangumiDetail(
          html: Self.demoDetailHTML(for: card),
          bangumiId: card.bangumiId,
          baseURL: baseURL
        )
      } else if let contentService {
        detail = try await contentService.detail(baseURL: baseURL, bangumiId: card.bangumiId)
      } else {
        throw MikanContentServiceError.invalidResponse
      }
      state.detail = detail
      if let initialSubgroupID,
        detail.subgroups.contains(where: { $0.id == initialSubgroupID })
      {
        state.selectedSubgroupID = initialSubgroupID
      } else {
        state.selectedSubgroupID = detail.subgroups.first?.id
      }
      title = detail.title.isEmpty ? card.title : detail.title
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  private static func demoDetailHTML(for card: MikanBangumiCard) -> String {
    let subjectID = card.bangumiId == "4102" ? "500002" : "500001"
    return """
      <div class="bangumi-poster" style="background-image:url('https://picsum.photos/seed/\(card.bangumiId)/400/560')"></div>
      <p class="bangumi-title">\(card.title)</p>
      <a href="https://bgm.tv/subject/\(subjectID)">Bangumi</a>
      <div class="subgroup-text" id="583"><a href="/Home/PublishGroup/583">ANi</a></div>
      <table><tr>
        <td><a href="/Home/Episode/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c">详情</a></td>
        <td><a class="magnet-link-wrap">[ANi] \(card.title) - 01 [1080P]</a></td>
        <td>710.4 MB</td><td>2026/07/07 23:30</td>
        <td><a href="/Download/20260707/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent">Torrent</a></td>
      </tr></table>
      <div class="subgroup-text" id="370"><a href="/Home/PublishGroup/370">LoliHouse</a></div>
      <table><tr>
        <td><a href="/Home/Episode/ae49d7fc3a508076996f0c438d73b24d7f27855d">详情</a></td>
        <td><a class="magnet-link-wrap">[LoliHouse] \(card.title) - 01 [WebRip 1080p]</a></td>
        <td>653.2 MB</td><td>2026/07/08 01:10</td>
        <td><a href="/Download/20260708/ae49d7fc3a508076996f0c438d73b24d7f27855d.torrent">Torrent</a></td>
      </tr></table>
      """
  }
}
