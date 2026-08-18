import Observation
import SwiftUI
import UIKit

enum DiscoverProvider: String, CaseIterable, Hashable, Identifiable, Sendable {
  case mikan
  case mteam

  var id: String { rawValue }

  var title: String {
    switch self {
    case .mikan: "Mikan"
    case .mteam: "M-Team"
    }
  }
}

@MainActor
@Observable
private final class DiscoverState {
  var availableProviders: [DiscoverProvider] = []
  var baseURL: URL?
  var errorMessage: String?
  var isLoading = false
  var parserStatus = "正在加载 Mikan 内容"
  var provider = DiscoverProvider.mikan
  var providerAvailabilityMessage = "正在读取内容来源配置"
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

final class DiscoverViewController: SwiftUIHostingViewController, UISearchResultsUpdating,
  UISearchBarDelegate
{
  var onOpenContentSources: (() -> Void)?

  private let credentialStore: any MTeamCredentialStore
  private let defaults: UserDefaults
  private let model: AppModel
  private let mteamService: any MTeamService
  private let mteamState: MTeamDiscoverState
  private let runtime: MikanJavaScriptRuntime?
  private let contentService: MikanContentService?
  private let state = DiscoverState()
  private var searchTask: Task<Void, Never>?
  private lazy var mteamSelectButton = UIBarButtonItem(
    image: UIImage(systemName: "checkmark.circle"),
    style: .plain,
    target: self,
    action: #selector(beginMTeamSelection)
  )

  init(
    model: AppModel,
    mikanRuntime: MikanRuntimeInstallation,
    defaults: UserDefaults = .standard,
    credentialStore: any MTeamCredentialStore = KeychainMTeamCredentialStore(),
    mteamService: (any MTeamService)? = nil
  ) {
    self.model = model
    self.defaults = defaults
    self.credentialStore = credentialStore
    self.mteamService =
      mteamService ?? (model.isDemoMode ? DemoMTeamService() : URLSessionMTeamService())
    mteamState = MTeamDiscoverState(defaults: defaults)
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
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always

    host(
      DiscoverRootContentView(
        onLoadMoreMTeam: { [weak self] in
          self?.loadMoreMTeam()
        },
        onOpenBangumi: { [weak self] card in
          self?.showDetail(card)
        },
        onOpenContentSources: { [weak self] in
          self?.onOpenContentSources?()
        },
        onOpenMTeamTorrent: { [weak self] torrent in
          self?.showMTeamDetail(torrent)
        },
        onRetryMTeam: { [weak self] in
          self?.retryMTeamSearch()
        },
        onRetryMikan: { [weak self] in
          self?.retryMikanRequest()
        },
        onSelectSeason: { [weak self] year, season in
          self?.selectSeason(year: year, season: season)
        },
        onSubmitMTeamSearch: { [weak self] in
          self?.submitMTeamSearch()
        },
        onToggleMTeamSelection: { [weak self] torrent in
          self?.toggleMTeamSelection(torrent)
        }
      )
      .environment(state)
      .environment(mteamState)
    )
    configureSearchController()
    mteamSelectButton.accessibilityLabel = "选择 M-Team Torrent"
    mteamSelectButton.accessibilityIdentifier = "mteam-select"
    refreshProviderAvailability()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    refreshProviderAvailability()
  }

  deinit {
    searchTask?.cancel()
  }

  func updateSearchResults(for searchController: UISearchController) {
    let query = searchController.searchBar.text ?? ""
    if state.provider == .mteam {
      mteamState.query = query
      let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.isEmpty {
        mteamState.errorMessage = nil
        mteamState.hasMore = false
        mteamState.items = []
        mteamState.page = 0
        mteamState.submittedQuery = ""
        mteamState.total = 0
      }
      return
    }

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
      await self?.searchMikan(trimmed)
    }
  }

  func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
    guard state.provider == .mteam else { return }
    submitMTeamSearch()
  }

  private func submitMTeamSearch() {
    let query = mteamState.query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard state.provider == .mteam, !query.isEmpty else { return }
    navigationItem.searchController?.searchBar.resignFirstResponder()
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      await self?.searchMTeam(query: query, page: 1, appending: false)
    }
  }

  private func configureSearchController() {
    let searchController = UISearchController(searchResultsController: nil)
    searchController.hidesNavigationBarDuringPresentation = false
    searchController.obscuresBackgroundDuringPresentation = false
    searchController.searchResultsUpdater = self
    searchController.searchBar.delegate = self
    searchController.searchBar.placeholder = "搜索番组"
    searchController.searchBar.accessibilityIdentifier = "discover-search"
    navigationItem.searchController = searchController
    navigationItem.hidesSearchBarWhenScrolling = false
    definesPresentationContext = true
  }

  private func loadInitialContent() async {
    guard state.provider == .mikan else { return }
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

  private func searchMikan(_ query: String) async {
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
      defaults.string(forKey: "discover.mikan.baseURL")
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

  private func retryMikanRequest() {
    searchTask?.cancel()
    let query = state.query.trimmingCharacters(in: .whitespacesAndNewlines)
    searchTask = Task {
      if query.isEmpty {
        await loadSeasonWall()
      } else {
        await searchMikan(query)
      }
    }
  }

  private func refreshProviderAvailability() {
    var providers: [DiscoverProvider] = []
    let mikanEnabled =
      model.isDemoMode
      || defaults.object(forKey: "discover.mikan.enabled") == nil
      || defaults.bool(forKey: "discover.mikan.enabled")
    if mikanEnabled {
      providers.append(.mikan)
    }

    let mteamEnabled = model.isDemoMode || defaults.bool(forKey: "discover.mteam.enabled")
    if mteamEnabled {
      do {
        if model.isDemoMode {
          providers.append(.mteam)
        } else if try credentialStore.apiKey()?.isEmpty == false {
          providers.append(.mteam)
        }
      } catch {
        state.providerAvailabilityMessage = error.localizedDescription
      }
    }

    state.availableProviders = providers
    guard !providers.isEmpty else {
      state.providerAvailabilityMessage = "请先在设置中启用并完成至少一个内容来源。"
      navigationItem.subtitle = nil
      navigationItem.rightBarButtonItems = []
      navigationItem.searchController?.searchBar.isUserInteractionEnabled = false
      return
    }

    let forcedMTeam = ProcessInfo.processInfo.arguments.contains("-ui-mteam-demo")
    let remembered = defaults.string(forKey: "discover.lastProvider").flatMap(DiscoverProvider.init)
    let preferred: DiscoverProvider = forcedMTeam ? .mteam : (remembered ?? state.provider)
    if providers.contains(preferred) {
      state.provider = preferred
    } else if !providers.contains(state.provider) {
      state.provider = providers[0]
    }
    navigationItem.searchController?.searchBar.isUserInteractionEnabled = true
    configureProviderChrome()
    loadProviderIfNeeded()
  }

  private func configureProviderChrome() {
    navigationItem.subtitle = state.provider.title
    guard let searchBar = navigationItem.searchController?.searchBar else { return }
    searchBar.placeholder = state.provider == .mikan ? "搜索番组" : "搜索 M-Team Torrent"
    searchBar.text = state.provider == .mikan ? state.query : mteamState.query
    searchBar.returnKeyType = .search

    var items: [UIBarButtonItem] = []
    if state.provider == .mikan {
      let subscriptions = UIBarButtonItem(
        image: UIImage(systemName: "bookmark"),
        style: .plain,
        target: self,
        action: #selector(showSubscriptions)
      )
      subscriptions.accessibilityLabel = "我的订阅"
      subscriptions.accessibilityIdentifier = "discover-subscriptions"
      items.append(subscriptions)
    } else {
      mteamSelectButton.isEnabled = !mteamState.items.isEmpty
      items.append(mteamSelectButton)
      let filters = UIBarButtonItem(
        image: UIImage(systemName: "line.3.horizontal.decrease"),
        style: .plain,
        target: self,
        action: #selector(showMTeamFilters)
      )
      filters.accessibilityLabel = "M-Team 筛选"
      filters.accessibilityIdentifier = "mteam-filters"
      items.append(filters)
    }

    if state.availableProviders.count > 1 {
      let providerItem = UIBarButtonItem(
        title: state.provider.title,
        image: UIImage(systemName: "chevron.up.chevron.down"),
        menu: UIMenu(
          title: "内容来源",
          children: state.availableProviders.map { provider in
            UIAction(
              title: provider.title,
              state: provider == state.provider ? .on : .off
            ) { [weak self] _ in
              self?.selectProvider(provider)
            }
          }
        )
      )
      providerItem.accessibilityIdentifier = "discover-provider-menu"
      items.append(providerItem)
    }
    navigationItem.rightBarButtonItems = items
  }

  private func selectProvider(_ provider: DiscoverProvider) {
    guard state.availableProviders.contains(provider), provider != state.provider else { return }
    searchTask?.cancel()
    state.provider = provider
    defaults.set(provider.rawValue, forKey: "discover.lastProvider")
    configureProviderChrome()
    loadProviderIfNeeded()
  }

  private func loadProviderIfNeeded() {
    guard state.provider == .mikan, state.seasonWall == nil, !state.isLoading else { return }
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      await self?.loadInitialContent()
    }
  }

  private func mteamConfiguration() throws -> MTeamProviderConfiguration {
    if model.isDemoMode {
      return try MTeamProviderConfiguration(
        baseURLText: "https://api.m-team.example.test/api",
        apiKey: "demo-key",
        pageSize: 20
      )
    }
    let apiKey = try credentialStore.apiKey() ?? ""
    let pageSize = defaults.integer(forKey: "discover.mteam.pageSize")
    return try MTeamProviderConfiguration(
      baseURLText: defaults.string(forKey: "discover.mteam.baseURL")
        ?? "https://api.m-team.cc/api",
      apiKey: apiKey,
      pageSize: pageSize == 0 ? 20 : pageSize
    )
  }

  private func searchMTeam(query: String, page: Int, appending: Bool) async {
    guard state.provider == .mteam else { return }
    mteamState.isLoading = true
    mteamState.errorMessage = nil
    defer { mteamState.isLoading = false }

    do {
      let result = try await mteamService.search(
        configuration: mteamConfiguration(),
        query: query,
        filters: mteamState.filters,
        page: page
      )
      guard !Task.isCancelled, state.provider == .mteam else { return }
      mteamState.items = appending ? mteamState.items + result.items : result.items
      mteamState.hasMore = result.hasMore
      mteamState.page = result.page
      mteamState.query = query
      mteamState.submittedQuery = query
      mteamState.total = result.total
      mteamSelectButton.isEnabled = !mteamState.items.isEmpty
    } catch is CancellationError {
      return
    } catch {
      if !appending {
        mteamState.items = []
      }
      mteamState.errorMessage = error.localizedDescription
    }
  }

  private func loadMoreMTeam() {
    guard !mteamState.isLoading, mteamState.hasMore, !mteamState.submittedQuery.isEmpty else {
      return
    }
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      guard let self else { return }
      await searchMTeam(
        query: mteamState.submittedQuery,
        page: mteamState.page + 1,
        appending: true
      )
    }
  }

  private func retryMTeamSearch() {
    let query = mteamState.submittedQuery.isEmpty ? mteamState.query : mteamState.submittedQuery
    guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      await self?.searchMTeam(query: query, page: 1, appending: false)
    }
  }

  private func showMTeamDetail(_ torrent: MTeamTorrent) {
    do {
      navigationController?.pushViewController(
        MTeamDetailViewController(
          torrent: torrent,
          configuration: try mteamConfiguration(),
          service: mteamService,
          model: model
        ),
        animated: true
      )
    } catch {
      mteamState.errorMessage = error.localizedDescription
    }
  }

  @objc private func beginMTeamSelection() {
    guard state.provider == .mteam, !mteamState.items.isEmpty else { return }
    mteamState.beginSelection()
    navigationItem.searchController?.searchBar.isUserInteractionEnabled = false
    navigationItem.leftBarButtonItem?.isEnabled = false
    let done = UIBarButtonItem(
      title: "完成",
      style: .prominent,
      target: self,
      action: #selector(endMTeamSelection)
    )
    done.accessibilityIdentifier = "mteam-select-done"
    navigationItem.rightBarButtonItems = [done]
    tabBarController?.setTabBarHidden(true, animated: false)
    configureMTeamSelectionToolbar()
  }

  @objc private func endMTeamSelection() {
    mteamState.endSelection()
    navigationItem.searchController?.searchBar.isUserInteractionEnabled = true
    navigationItem.leftBarButtonItem?.isEnabled = true
    navigationController?.setToolbarHidden(true, animated: false)
    configureProviderChrome()
    DispatchQueue.main.async { [weak self] in
      guard let self, !mteamState.isSelecting else { return }
      tabBarController?.setTabBarHidden(false, animated: false)
    }
  }

  private func toggleMTeamSelection(_ torrent: MTeamTorrent) {
    mteamState.toggleSelection(for: torrent.id)
    updateMTeamSelectionToolbar()
  }

  private func configureMTeamSelectionToolbar() {
    let count = UIBarButtonItem(title: "已选择 0 项", style: .plain, target: nil, action: nil)
    count.tag = 1
    let importItem = UIBarButtonItem(
      title: "批量导入",
      style: .prominent,
      target: self,
      action: #selector(presentMTeamBatchImport)
    )
    importItem.accessibilityIdentifier = "mteam-batch-import"
    importItem.tag = 2
    toolbarItems = [count, UIBarButtonItem(systemItem: .flexibleSpace), importItem]
    DispatchQueue.main.async { [weak self] in
      guard let self, mteamState.isSelecting else { return }
      navigationController?.setToolbarHidden(false, animated: false)
    }
    updateMTeamSelectionToolbar()
  }

  private func updateMTeamSelectionToolbar() {
    let count = mteamState.selectedIDs.count
    toolbarItems?.first(where: { $0.tag == 1 })?.title = "已选择 \(count) 项"
    toolbarItems?.first(where: { $0.tag == 2 })?.isEnabled = count > 0
  }

  @objc private func presentMTeamBatchImport() {
    let selected = mteamState.items.filter { mteamState.selectedIDs.contains($0.id) }
    guard !selected.isEmpty else { return }
    do {
      MTeamBatchImportViewController.present(
        from: self,
        torrents: selected,
        configuration: try mteamConfiguration(),
        service: mteamService,
        model: model
      ) { [weak self] in
        self?.endMTeamSelection()
      }
    } catch {
      mteamState.errorMessage = error.localizedDescription
    }
  }

  @objc private func showMTeamFilters() {
    MTeamFilterViewController.present(
      from: self,
      filters: mteamState.filters
    ) { [weak self] filters in
      guard let self else { return }
      mteamState.filters = filters
      defaults.set(filters.mode, forKey: "discover.mteam.mode")
      if !mteamState.submittedQuery.isEmpty {
        retryMTeamSearch()
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

private struct DiscoverRootContentView: View {
  @Environment(DiscoverState.self) private var state

  let onLoadMoreMTeam: () -> Void
  let onOpenBangumi: (MikanBangumiCard) -> Void
  let onOpenContentSources: () -> Void
  let onOpenMTeamTorrent: (MTeamTorrent) -> Void
  let onRetryMTeam: () -> Void
  let onRetryMikan: () -> Void
  let onSelectSeason: (Int, String) -> Void
  let onSubmitMTeamSearch: () -> Void
  let onToggleMTeamSelection: (MTeamTorrent) -> Void

  var body: some View {
    if state.availableProviders.isEmpty {
      ContentUnavailableView {
        Label("没有可用的内容来源", systemImage: "safari")
      } description: {
        Text(state.providerAvailabilityMessage)
      } actions: {
        Button("前往设置", action: onOpenContentSources)
      }
    } else {
      switch state.provider {
      case .mikan:
        MikanDiscoverContentView(
          onOpenBangumi: onOpenBangumi,
          onRetry: onRetryMikan,
          onSelectSeason: onSelectSeason
        )
      case .mteam:
        MTeamDiscoverContentView(
          onLoadMore: onLoadMoreMTeam,
          onOpenTorrent: onOpenMTeamTorrent,
          onRetry: onRetryMTeam,
          onSubmitSearch: onSubmitMTeamSearch,
          onToggleSelection: onToggleMTeamSelection
        )
      }
    }
  }
}

private struct MikanDiscoverContentView: View {
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

struct MikanBangumiCardView: View {
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
