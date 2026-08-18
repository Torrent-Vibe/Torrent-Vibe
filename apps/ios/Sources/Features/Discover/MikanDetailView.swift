import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class MikanDetailState {
  var detail: MikanBangumiDetail?
  var errorMessage: String?
  var isLoading = true
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
    host(
      MikanDetailContentView(
        card: card,
        baseURL: baseURL,
        onImportEpisode: { [weak self] episode in
          self?.showImport(for: episode)
        },
        onSubscribe: { [weak self] subgroup in
          self?.showHelperAction(.subscribe, subgroup: subgroup)
        },
        onBackfill: { [weak self] subgroup in
          self?.showHelperAction(.backfill, subgroup: subgroup)
        }
      )
      .environment(model)
      .environment(state)
    )
    Task { await loadDetail() }
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

  private func showHelperAction(_ action: MikanHelperActionKind, subgroup: MikanSubgroup) {
    guard let detail = state.detail else { return }
    MikanHelperActionViewController.present(
      from: self,
      action: action,
      baseURL: baseURL,
      detail: detail,
      subgroup: subgroup,
      model: model
    ) { [weak self] success in
      self?.presentHelperSuccess(success)
    }
  }

  private func presentHelperSuccess(_ success: MikanHelperActionSuccess) {
    let alert: UIAlertController
    switch success {
    case .subscribed(let outcome):
      let targets = outcome.serverNames.joined(separator: "、")
      let message =
        outcome.mergedConflict
        ? "Helper 在写入期间收到其他客户端更新；App 已基于最新 revision 合并，并保留远端已有订阅。目标：\(targets)。"
        : "Helper 已保存持续订阅。目标：\(targets)。"
      alert = UIAlertController(title: "已开始持续订阅", message: message, preferredStyle: .alert)
    case .backfilled(let outcome):
      alert = UIAlertController(
        title: "已提交 \(outcome.episodeCount) 个剧集",
        message: "\(outcome.serverName) 的 Helper 已接收一次性导入；此操作没有创建持续订阅。",
        preferredStyle: .alert
      )
    }
    alert.addAction(UIAlertAction(title: "完成", style: .default))
    present(alert, animated: true)
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
      <div class="bangumi-poster" style="background-image:url('/images/demo-cover.jpg')"></div>
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
  let onSubscribe: (MikanSubgroup) -> Void
  let onBackfill: (MikanSubgroup) -> Void

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
                    canImport: model.activeServer != nil
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
        .contentMargins(.top, 4)
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
    HStack(alignment: .top, spacing: 16) {
      MikanBangumiCardView(
        item: MikanBangumiCard(
          bangumiId: detail.bangumiId,
          coverUrl: detail.coverUrl ?? card.coverUrl,
          title: detail.title,
          weekday: card.weekday
        ),
        baseURL: baseURL,
        showsTitle: false
      )
      .frame(width: 120)
      .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 6) {
        Text(detail.title.isEmpty ? card.title : detail.title)
          .font(.title3.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityIdentifier("mikan-detail-title")

        if !detail.subgroups.isEmpty {
          subgroupMenu(detail.subgroups)
        }

        if let subjectID = detail.bangumiSubjectId {
          Link(
            "在 Bangumi 查看",
            destination: URL(string: "https://bgm.tv/subject/\(subjectID)")!
          )
          .font(.subheadline)
        }

        if let subgroup = selectedSubgroup(detail.subgroups) {
          headerActions(detail, subgroup: subgroup)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 0, trailing: 16))
    .listRowBackground(Color.clear)
    .listRowSeparator(.hidden)
  }

  private func subgroupMenu(_ subgroups: [MikanSubgroup]) -> some View {
    Menu {
      Button("全部字幕组") {
        state.selectedSubgroupID = nil
      }
      ForEach(subgroups) { subgroup in
        Button(subgroup.name.isEmpty ? "字幕组 \(subgroup.id)" : subgroup.name) {
          state.selectedSubgroupID = subgroup.id
        }
      }
    } label: {
      HStack(spacing: 4) {
        Text(selectedSubgroupCaption(subgroups))
        if subgroups.count > 1 {
          Image(systemName: "chevron.up.chevron.down")
            .font(.caption2.weight(.semibold))
        }
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("mikan-detail-subgroup")
  }

  private func headerActions(_ detail: MikanBangumiDetail, subgroup: MikanSubgroup) -> some View {
    HStack(spacing: 8) {
      Button {
        onSubscribe(subgroup)
      } label: {
        Text("订阅")
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.regular)
      .disabled(model.pairedHelperServers.isEmpty)
      .accessibilityIdentifier("mikan-detail-subscribe")

      Button {
        onBackfill(subgroup)
      } label: {
        Text("导入已出")
      }
      .buttonStyle(.bordered)
      .controlSize(.regular)
      .disabled(
        model.pairedHelperServers.isEmpty
          || detail.episodes.allSatisfy { $0.subgroupId != subgroup.id }
      )
      .accessibilityIdentifier("mikan-detail-backfill")
    }
  }

  private func selectedSubgroupCaption(_ subgroups: [MikanSubgroup]) -> String {
    let subgroup = selectedSubgroup(subgroups)
    let name = subgroup?.name.isEmpty == false ? subgroup?.name : nil
    if state.selectedSubgroupID == nil {
      return "全部字幕组 · Mikan"
    }
    return "\(name ?? subgroup?.id ?? "字幕组") · Mikan"
  }

  private func selectedSubgroup(_ subgroups: [MikanSubgroup]) -> MikanSubgroup? {
    guard let selected = state.selectedSubgroupID else { return subgroups.first }
    return subgroups.first { $0.id == selected }
  }

  private func filteredEpisodes(_ detail: MikanBangumiDetail) -> [MikanEpisode] {
    guard let selected = state.selectedSubgroupID else { return detail.episodes }
    return detail.episodes.filter { $0.subgroupId == selected }
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
