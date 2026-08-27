import SwiftUI

struct MikanDetailContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanDetailState.self) private var state

  let card: MikanBangumiCard
  let baseURL: URL
  let onImportEpisode: (MikanEpisode) -> Void
  let onRetryEpisode: (String, HelperEpisodeStatus) -> Void

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
                episodeRow(episode, detail: detail)
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
          Text(state.errorMessage ?? String(localized: "未知错误"))
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

  @ViewBuilder
  private func episodeRow(_ episode: MikanEpisode, detail: MikanBangumiDetail) -> some View {
    let subgroupID = state.selectedSubgroupID ?? episode.subgroupId
    let status = helperStatus(for: episode, detail: detail)
    let subscribed =
      subgroupID.flatMap {
        model.helperSubscriptionGroup(bangumiID: detail.bangumiId, subgroupID: $0)
      } != nil
    let rowModel = MikanEpisodeRowModelBuilder.build(
      state: status?.state,
      infohash: status?.infohash,
      subscribed: subscribed,
      torrentIndex: torrentIndex
    )
    let canImport = model.activeServer != nil

    if subscribed {
      MikanEpisodeRow(
        episode: episode,
        canImport: canImport,
        rowModel: rowModel,
        isRetrying: isRetrying(subgroupID: subgroupID, episodeID: episode.episodeId),
        onRetry: {
          guard let subgroupID, let status else { return }
          onRetryEpisode(subgroupID, status)
        },
        onDownloadAnyway: { onImportEpisode(episode) }
      )
      .listRowInsets(EdgeInsets(top: 11, leading: 16, bottom: 11, trailing: 16))
    } else {
      Button {
        onImportEpisode(episode)
      } label: {
        MikanEpisodeRow(
          episode: episode,
          canImport: canImport,
          rowModel: rowModel,
          isRetrying: false,
          onRetry: {},
          onDownloadAnyway: {}
        )
      }
      .buttonStyle(.plain)
      .listRowInsets(EdgeInsets(top: 11, leading: 16, bottom: 11, trailing: 16))
      .disabled(!canImport)
      .accessibilityIdentifier("mikan-episode-import-\(episode.episodeId)")
    }
  }

  private func isRetrying(subgroupID: String?, episodeID: String) -> Bool {
    guard let subgroupID else { return false }
    return state.retryingEpisodeIDs.contains(
      MikanDetailViewController.retryID(subgroupID: subgroupID, episodeID: episodeID)
    )
  }

  private var torrentIndex: MikanEpisodeTorrentIndex {
    MikanEpisodeTorrentIndex(torrents: model.torrents)
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
      return String(localized: "点按剧集可导入单集。配对 Helper 后可订阅整季。")
    }
    if let server = model.activeServer {
      return String(localized: "点按剧集可导入到 \(server.name)。")
    }
    return String(localized: "添加服务器后可导入单集。")
  }
}
