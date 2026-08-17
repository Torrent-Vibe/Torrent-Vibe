import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class DiscoverState {
  var baseURL: URL?
  var errorMessage: String?
  var isLoading = false
  var parserStatus = "正在加载 Mikan 内容"
  var query = ""
  var searchResults: [MikanBangumiCard] = []
  var seasonWall: MikanSeasonWall?
  var selectedSeason: String
  var selectedYear: Int
  var wallParserStatus = "正在加载 Mikan 内容"

  init(now: Date = .now, calendar: Calendar = .current) {
    let month = calendar.component(.month, from: now)
    selectedYear = calendar.component(.year, from: now)
    selectedSeason =
      switch month {
      case 1...3: "冬"
      case 4...6: "春"
      case 7...9: "夏"
      default: "秋"
      }
  }
}

final class DiscoverViewController: SwiftUIHostingViewController, UISearchResultsUpdating {
  private let model: AppModel
  private let runtime: MikanJavaScriptRuntime?
  private let contentService: MikanContentService?
  private let state = DiscoverState()
  private var searchTask: Task<Void, Never>?

  init(model: AppModel, mikanRuntime: MikanRuntimeInstallation) {
    self.model = model
    switch mikanRuntime {
    case .available(let runtime):
      self.runtime = runtime
      contentService = MikanContentService(runtime: runtime)
    case .unavailable:
      runtime = nil
      contentService = nil
    }
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "发现"
    navigationItem.subtitle = "Mikan"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      image: UIImage(systemName: "bookmark"),
      style: .plain,
      target: self,
      action: #selector(showSubscriptions)
    )
    navigationItem.rightBarButtonItem?.accessibilityLabel = "我的订阅"
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "discover-subscriptions"

    host(
      DiscoverContentView(
        onOpenBangumi: { [weak self] card in
          self?.showDetail(card)
        },
        onRetry: { [weak self] in
          self?.retryCurrentRequest()
        },
        onSelectSeason: { [weak self] year, season in
          self?.selectSeason(year: year, season: season)
        }
      )
      .environment(state)
    )
    configureSearchController()

    Task { await loadInitialContent() }
  }

  deinit {
    searchTask?.cancel()
  }

  func updateSearchResults(for searchController: UISearchController) {
    let query = searchController.searchBar.text ?? ""
    state.query = query
    searchTask?.cancel()

    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      state.searchResults = []
      state.errorMessage = nil
      if state.seasonWall == nil {
        searchTask = Task { await loadSeasonWall() }
      } else {
        state.parserStatus = state.wallParserStatus
      }
      return
    }

    searchTask = Task { [weak self] in
      try? await Task.sleep(for: .milliseconds(350))
      guard !Task.isCancelled else { return }
      await self?.search(trimmed)
    }
  }

  private func configureSearchController() {
    let searchController = UISearchController(searchResultsController: nil)
    searchController.obscuresBackgroundDuringPresentation = false
    searchController.searchResultsUpdater = self
    searchController.searchBar.placeholder = "搜索番组"
    searchController.searchBar.accessibilityIdentifier = "discover-search"
    navigationItem.searchController = searchController
    navigationItem.hidesSearchBarWhenScrolling = false
    definesPresentationContext = true
  }

  private func loadInitialContent() async {
    guard let runtime else {
      state.errorMessage = "Mikan JavaScriptCore Bridge 不可用。"
      state.parserStatus = "解析器不可用"
      return
    }

    if model.isDemoMode {
      do {
        let wall = try await runtime.parseSeasonWall(html: Self.demoSeasonHTML)
        apply(wall: wall, source: "演示内容")
      } catch {
        state.errorMessage = error.localizedDescription
      }
      return
    }

    guard let baseURL = configuredBaseURL() else { return }
    state.baseURL = baseURL
    await loadSeasonWall()
  }

  private func loadSeasonWall() async {
    guard let service = contentService, let baseURL = state.baseURL ?? configuredBaseURL() else {
      return
    }
    state.baseURL = baseURL
    state.isLoading = true
    state.errorMessage = nil
    defer { state.isLoading = false }

    do {
      let wall = try await service.seasonWall(
        baseURL: baseURL,
        year: state.selectedYear,
        season: state.selectedSeason
      )
      guard !Task.isCancelled else { return }
      apply(wall: wall, source: "实时内容")
    } catch is CancellationError {
      return
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  private func search(_ query: String) async {
    guard let service = contentService, let baseURL = state.baseURL ?? configuredBaseURL() else {
      return
    }
    state.baseURL = baseURL
    state.isLoading = true
    state.errorMessage = nil
    defer { state.isLoading = false }

    do {
      let results = try await service.search(baseURL: baseURL, query: query)
      guard !Task.isCancelled, state.query.trimmingCharacters(in: .whitespacesAndNewlines) == query
      else { return }
      state.searchResults = results
      state.parserStatus = "实时搜索 · JavaScriptCore Bridge v1 · \(results.count) 部番组"
    } catch is CancellationError {
      return
    } catch {
      state.searchResults = []
      state.errorMessage = error.localizedDescription
    }
  }

  private func apply(wall: MikanSeasonWall, source: String) {
    state.seasonWall = wall
    // Some Mikan responses omit the season heading even though the requested
    // wall is valid. Preserve the requested filter instead of presenting 0.
    if wall.year > 0 {
      state.selectedYear = wall.year
    }
    if !wall.season.isEmpty {
      state.selectedSeason = wall.season
    }
    let count = wall.groups.reduce(0) { $0 + $1.items.count }
    let status = "\(source) · JavaScriptCore Bridge v1 · \(count) 部番组"
    state.parserStatus = status
    state.wallParserStatus = status
  }

  private func configuredBaseURL() -> URL? {
    let value =
      UserDefaults.standard.string(forKey: "discover.mikan.baseURL")
      ?? "https://mikanani.me"
    guard
      let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
      ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
      url.host != nil
    else {
      state.errorMessage = "请在设置中填写有效的 Mikan Base URL。"
      return nil
    }
    return url
  }

  private func selectSeason(year: Int, season: String) {
    state.selectedYear = year
    state.selectedSeason = season
    searchTask?.cancel()
    searchTask = Task { await loadSeasonWall() }
  }

  private func retryCurrentRequest() {
    searchTask?.cancel()
    let query = state.query.trimmingCharacters(in: .whitespacesAndNewlines)
    searchTask = Task {
      if query.isEmpty {
        await loadSeasonWall()
      } else {
        await search(query)
      }
    }
  }

  private func showDetail(
    _ card: MikanBangumiCard,
    initialSubgroupID: String? = nil
  ) {
    guard let runtime, let baseURL = state.baseURL ?? configuredBaseURL() else { return }
    navigationController?.pushViewController(
      MikanDetailViewController(
        card: card,
        baseURL: baseURL,
        runtime: runtime,
        contentService: contentService,
        isDemoMode: model.isDemoMode,
        model: model,
        initialSubgroupID: initialSubgroupID
      ),
      animated: true
    )
  }

  @objc private func showSubscriptions() {
    navigationController?.pushViewController(
      SubscriptionsViewController(model: model) { [weak self] group in
        self?.showDetail(
          MikanBangumiCard(
            bangumiId: group.replica.bangumiId,
            coverUrl: nil,
            title: group.replica.title,
            weekday: nil
          ),
          initialSubgroupID: group.replica.subgroupId
        )
      },
      animated: true
    )
  }

  fileprivate static let demoSeasonHTML = """
    <div class="sk-col date-text">2026 夏</div>
    <div class="sk-bangumi" data-dayofweek="2">
      <ul class="an-ul">
        <li data-bangumiid="4101"><div class="an-text" title="夏日观测站"></div></li>
        <li data-bangumiid="4102"><div class="an-text" title="星海列车"></div></li>
      </ul>
    </div>
    <div class="sk-bangumi" data-dayofweek="5">
      <ul class="an-ul">
        <li data-bangumiid="4103"><div class="an-text" title="雨后通信"></div></li>
        <li data-bangumiid="4104"><div class="an-text" title="无声航路"></div></li>
      </ul>
    </div>
    """
}

private struct DiscoverContentView: View {
  @Environment(DiscoverState.self) private var state

  let onOpenBangumi: (MikanBangumiCard) -> Void
  let onRetry: () -> Void
  let onSelectSeason: (Int, String) -> Void

  var body: some View {
    ScrollView {
      if !state.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        searchContent
      } else if let wall = state.seasonWall {
        seasonContent(wall)
      } else if state.isLoading {
        ProgressView("正在载入 Mikan 番组")
          .frame(maxWidth: .infinity, minHeight: 480)
      } else {
        unavailableContent
      }
    }
  }

  @ViewBuilder
  private var searchContent: some View {
    if state.isLoading, state.searchResults.isEmpty {
      ProgressView("正在搜索 Mikan")
        .frame(maxWidth: .infinity, minHeight: 480)
    } else if state.searchResults.isEmpty {
      ContentUnavailableView {
        Label("没有找到番组", systemImage: "magnifyingglass")
      } description: {
        Text(state.errorMessage ?? "尝试更换关键词。")
      } actions: {
        if state.errorMessage != nil {
          Button("重试", action: onRetry)
        }
      }
      .frame(maxWidth: .infinity, minHeight: 480)
    } else {
      LazyVStack(alignment: .leading, spacing: 16) {
        HStack {
          Text("搜索结果")
            .font(.headline)
          Spacer()
          Text(state.parserStatus)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        errorBanner

        bangumiGrid(state.searchResults)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
    }
  }

  private func seasonContent(_ wall: MikanSeasonWall) -> some View {
    LazyVStack(alignment: .leading, spacing: 24) {
      HStack {
        seasonMenu
        Spacer()
        Text(state.parserStatus)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .multilineTextAlignment(.trailing)
      }

      errorBanner

      ForEach(wall.groups) { group in
        VStack(alignment: .leading, spacing: 12) {
          Text(weekdayName(group.weekday))
            .font(.title3.weight(.semibold))
          bangumiGrid(group.items)
        }
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }

  private var seasonMenu: some View {
    Menu {
      ForEach((state.selectedYear - 2)...state.selectedYear, id: \.self) { year in
        Menu(String(year)) {
          ForEach(["冬", "春", "夏", "秋"], id: \.self) { season in
            Button {
              onSelectSeason(year, season)
            } label: {
              Text(verbatim: "\(year) · \(season)")
            }
          }
        }
      }
    } label: {
      Label {
        Text(verbatim: "\(state.selectedYear) · \(state.selectedSeason)")
      } icon: {
        Image(systemName: "calendar")
      }
      .font(.headline)
    }
    .accessibilityIdentifier("discover-season-menu")
  }

  @ViewBuilder
  private var errorBanner: some View {
    if let errorMessage = state.errorMessage {
      HStack(alignment: .top, spacing: 10) {
        Image(systemName: "exclamationmark.triangle.fill")
          .foregroundStyle(.orange)
        Text(errorMessage)
          .font(.footnote)
        Spacer()
        Button("重试", action: onRetry)
      }
      .padding(12)
      .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
    }
  }

  private var unavailableContent: some View {
    ContentUnavailableView {
      Label("Mikan 内容不可用", systemImage: "safari")
    } description: {
      Text(state.errorMessage ?? state.parserStatus)
    } actions: {
      Button("重试", action: onRetry)
    }
    .frame(maxWidth: .infinity, minHeight: 480)
  }

  private func bangumiGrid(_ items: [MikanBangumiCard]) -> some View {
    LazyVGrid(
      columns: [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
      ],
      spacing: 18
    ) {
      ForEach(items) { item in
        Button {
          onOpenBangumi(item)
        } label: {
          MikanBangumiCardView(item: item, baseURL: state.baseURL)
        }
        .frame(maxWidth: .infinity)
        .buttonStyle(.plain)
        .accessibilityIdentifier("discover-bangumi-\(item.bangumiId)")
      }
    }
  }

  private func weekdayName(_ weekday: Int) -> String {
    switch weekday {
    case 0: "星期日"
    case 1: "星期一"
    case 2: "星期二"
    case 3: "星期三"
    case 4: "星期四"
    case 5: "星期五"
    case 6: "星期六"
    default: "特别放送"
    }
  }
}

private struct MikanBangumiCardView: View {
  let item: MikanBangumiCard
  let baseURL: URL?
  var showsTitle = true

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      GeometryReader { geometry in
        ZStack {
          RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(.quaternary)

          if let coverURL {
            AsyncImage(url: coverURL) { phase in
              switch phase {
              case .success(let image):
                image
                  .resizable()
                  .scaledToFill()
                  .frame(width: geometry.size.width, height: geometry.size.height)
                  .clipped()
              case .failure:
                placeholder
              default:
                ProgressView()
              }
            }
          } else {
            placeholder
          }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
      }
      .aspectRatio(0.72, contentMode: .fit)

      if showsTitle {
        Text(item.title)
          .font(.subheadline.weight(.medium))
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(Rectangle())
  }

  private var placeholder: some View {
    Image(systemName: "sparkles.tv")
      .font(.system(size: 36))
      .foregroundStyle(.secondary)
  }

  private var coverURL: URL? {
    guard let value = item.coverUrl, !value.isEmpty else { return nil }
    if let absolute = URL(string: value), absolute.scheme != nil {
      return absolute
    }
    guard let baseURL else { return nil }
    return URL(string: value, relativeTo: baseURL)?.absoluteURL
  }
}

@MainActor
@Observable
private final class MikanDetailState {
  var detail: MikanBangumiDetail?
  var errorMessage: String?
  var isLoading = true
  var selectedSubgroupID: String?
}

private final class MikanDetailViewController: SwiftUIHostingViewController {
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
    ScrollView {
      if let detail = state.detail {
        VStack(alignment: .leading, spacing: 20) {
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

            VStack(alignment: .leading, spacing: 8) {
              Text(detail.title.isEmpty ? card.title : detail.title)
                .font(.title2.weight(.bold))
                .accessibilityIdentifier("mikan-detail-title")
              Text("Mikan 番组")
                .font(.subheadline)
                .foregroundStyle(.secondary)
              if let subjectID = detail.bangumiSubjectId {
                Link(
                  "在 Bangumi 查看",
                  destination: URL(string: "https://bgm.tv/subject/\(subjectID)")!
                )
                .font(.subheadline)
              }
            }
          }

          if !detail.subgroups.isEmpty {
            subgroupMenu(detail.subgroups)
          }

          helperActions(detail)

          VStack(alignment: .leading, spacing: 12) {
            Text("剧集")
              .font(.headline)
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
                .disabled(model.activeServer == nil)
                .accessibilityIdentifier("mikan-episode-import-\(episode.episodeId)")
              }
            }
          }

          Label(importAvailabilityText, systemImage: "shippingbox")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(16)
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

  @ViewBuilder
  private func helperActions(_ detail: MikanBangumiDetail) -> some View {
    if let subgroup = selectedSubgroup(detail.subgroups) {
      VStack(alignment: .leading, spacing: 10) {
        Text("Helper")
          .font(.headline)
        HStack(spacing: 12) {
          Button {
            onSubscribe(subgroup)
          } label: {
            Label("订阅", systemImage: "bookmark")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          .disabled(model.pairedHelperServers.isEmpty)
          .accessibilityIdentifier("mikan-detail-subscribe")

          Button {
            onBackfill(subgroup)
          } label: {
            Label("导入已出", systemImage: "tray.and.arrow.down")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .disabled(
            model.pairedHelperServers.isEmpty
              || detail.episodes.allSatisfy { $0.subgroupId != subgroup.id }
          )
          .accessibilityIdentifier("mikan-detail-backfill")
        }
        Text(helperAvailabilityText)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      .padding(14)
      .background(.background, in: RoundedRectangle(cornerRadius: 14))
    }
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
      HStack {
        Label("字幕组", systemImage: "person.2")
        Spacer()
        Text(selectedSubgroupName(subgroups))
          .foregroundStyle(.secondary)
        Image(systemName: "chevron.up.chevron.down")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(14)
      .background(.background, in: RoundedRectangle(cornerRadius: 14))
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("mikan-detail-subgroup")
  }

  private func selectedSubgroupName(_ subgroups: [MikanSubgroup]) -> String {
    guard let selected = state.selectedSubgroupID else { return "全部" }
    return subgroups.first(where: { $0.id == selected })?.name ?? selected
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
    if let server = model.activeServer {
      return "点击剧集可直接导入到 \(server.name)；批量导入与持续订阅通过已配对 Helper 执行。"
    }
    return "添加服务器后可导入单集；浏览与番组详情仍可正常使用。"
  }

  private var helperAvailabilityText: String {
    if model.pairedHelperServers.isEmpty {
      return "请先在设置的服务器详情中完成 Helper 配对。"
    }
    return "持续订阅保存到 Helper；导入已出是一次性任务。"
  }
}

private struct MikanEpisodeRow: View {
  let episode: MikanEpisode
  let canImport: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(episode.title)
        .font(.subheadline.weight(.medium))
        .lineLimit(3)
      if canImport {
        Label("导入单集", systemImage: "arrow.down.circle")
          .font(.caption.weight(.medium))
          .foregroundStyle(.blue)
      }
      HStack {
        if let sizeBytes = episode.sizeBytes {
          Label(
            ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file),
            systemImage: "internaldrive")
        }
        Spacer()
        if let publishedAt = episode.publishedAt {
          Text(publishedAt)
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
    }
    .padding(14)
    .background(.background, in: RoundedRectangle(cornerRadius: 14))
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("mikan-episode-\(episode.episodeId)")
  }
}
