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
final class DiscoverState {
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

  let credentialStore: any MTeamCredentialStore
  let defaults: UserDefaults
  let model: AppModel
  let mteamService: any MTeamService
  let mteamState: MTeamDiscoverState
  let runtime: MikanJavaScriptRuntime?
  let contentService: MikanContentService?
  let state = DiscoverState()
  var searchTask: Task<Void, Never>?
  lazy var mteamSelectButton = UIBarButtonItem(
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
    navigationItem.largeTitleDisplayMode = .never

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
    Task { await model.refreshAllHelperSubscriptions() }
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

  func configureProviderChrome() {
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
