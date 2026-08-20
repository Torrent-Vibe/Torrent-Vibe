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
    Task { await model.refreshAllHelperSubscriptions() }
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
        AppToast.show("已取消订阅", from: self)
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
      AppToast.show("已更新订阅目标 · \(outcome.serverNames.joined(separator: "、"))", from: self)
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
    AppToast.show(message, from: self)
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

private struct MikanDetailContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanDetailState.self) private var state

  let card: MikanBangumiCard
  let baseURL: URL
  let onImportEpisode: (MikanEpisode) -> Void

  var body: some View {
    Group {
      if let detail = state.detail {
        List {
          Section {
            header(detail)
            Text("剧集")
              .font(.subheadline)
              .foregroundStyle(.secondary)
              .listRowInsets(EdgeInsets(top: 10, leading: 20, bottom: 2, trailing: 16))
              .listRowBackground(Color.clear)
              .listRowSeparator(.hidden)
          }

          Section {
            if filteredEpisodes(detail).isEmpty {
              Text("当前字幕组尚无剧集。")
                .foregroundStyle(.secondary)
            } else {
              ForEach(filteredEpisodes(detail)) { episode in
                Button {
                  onImportEpisode(episode)
                } label: {
                  MikanEpisodeRow(
                    episode: episode,
                    canImport: model.activeServer != nil,
                    helperStatus: helperStatus(for: episode, detail: detail)
                  )
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(top: 11, leading: 16, bottom: 11, trailing: 16))
                .disabled(model.activeServer == nil)
                .accessibilityIdentifier("mikan-episode-import-\(episode.episodeId)")
              }
            }
          } footer: {
            Text(importAvailabilityText)
          }
        }
        .listSectionSpacing(6)
        .contentMargins(.top, 8)
        .scrollContentBackground(.hidden)
        .background(alignment: .top) {
          MikanDetailHeroBackdrop(
            url: MikanCover.url(from: detail.coverUrl ?? card.coverUrl, baseURL: baseURL)
          )
          .ignoresSafeArea(edges: .top)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
      } else if state.isLoading {
        ProgressView("正在载入番组详情")
          .frame(maxWidth: .infinity, minHeight: 480)
      } else {
        ContentUnavailableView {
          Label("无法载入番组详情", systemImage: "exclamationmark.triangle")
        } description: {
          Text(state.errorMessage ?? "未知错误")
        }
        .frame(maxWidth: .infinity, minHeight: 480)
      }
    }
  }

  private func header(_ detail: MikanBangumiDetail) -> some View {
    MikanDetailHeader(
      card: card,
      detail: detail,
      baseURL: baseURL
    )
    .listRowInsets(
      EdgeInsets(
        top: AppSpacing.group,
        leading: 16,
        bottom: AppSpacing.section,
        trailing: 16
      )
    )
    .listRowBackground(Color.clear)
    .listRowSeparator(.hidden)
  }

  private func filteredEpisodes(_ detail: MikanBangumiDetail) -> [MikanEpisode] {
    guard let selected = state.selectedSubgroupID else { return detail.episodes }
    return detail.episodes.filter { $0.subgroupId == selected }
  }

  private func helperStatus(
    for episode: MikanEpisode,
    detail: MikanBangumiDetail
  ) -> HelperEpisodeStatus? {
    let subgroupID = state.selectedSubgroupID ?? episode.subgroupId
    guard let subgroupID else { return nil }
    return model.helperEpisodeStatus(
      bangumiID: detail.bangumiId,
      subgroupID: subgroupID,
      episodeID: episode.episodeId
    )
  }

  private var importAvailabilityText: String {
    if model.pairedHelperServers.isEmpty {
      return "点按剧集可导入单集。配对 Helper 后可订阅或导入已出。"
    }
    if let server = model.activeServer {
      return "点按剧集可导入到 \(server.name)。"
    }
    return "添加服务器后可导入单集。"
  }
}

private struct MikanEpisodeRow: View {
  let episode: MikanEpisode
  let canImport: Bool
  let helperStatus: HelperEpisodeStatus?

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text(episode.title)
          .font(.body)
          .foregroundStyle(.primary)
          .multilineTextAlignment(.leading)
        HStack(spacing: 8) {
          if let sizeBytes = episode.sizeBytes {
            Text(ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file))
              .monospacedDigit()
          }
          if let publishedAt = episode.publishedAt {
            Text(publishedAt)
          }
          if let helperStatus {
            Text(helperStatus.state.title)
              .foregroundStyle(helperStatus.state.isRetryable ? .red : .secondary)
          }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if canImport {
        Image(systemName: "plus.circle")
          .font(.title3)
          .foregroundStyle(.tint)
          .accessibilityHidden(true)
      }
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityHint(canImport ? "导入到当前服务器" : "")
    .accessibilityIdentifier("mikan-episode-\(episode.episodeId)")
  }
}
