import UIKit

extension DiscoverViewController {
  func submitMTeamSearch() {
    let query = mteamState.query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard state.provider == .mteam, !query.isEmpty else { return }
    navigationItem.searchController?.searchBar.resignFirstResponder()
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      await self?.searchMTeam(query: query, page: 1, appending: false)
    }
  }

  func mteamConfiguration() throws -> MTeamProviderConfiguration {
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

  func searchMTeam(query: String, page: Int, appending: Bool) async {
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

  func loadMoreMTeam() {
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

  func retryMTeamSearch() {
    let query = mteamState.submittedQuery.isEmpty ? mteamState.query : mteamState.submittedQuery
    guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    searchTask?.cancel()
    searchTask = Task { [weak self] in
      await self?.searchMTeam(query: query, page: 1, appending: false)
    }
  }

  func showMTeamDetail(_ torrent: MTeamTorrent) {
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

  @objc func beginMTeamSelection() {
    guard state.provider == .mteam, !mteamState.items.isEmpty else { return }
    mteamState.beginSelection()
    navigationItem.searchController?.searchBar.isUserInteractionEnabled = false
    navigationItem.leftBarButtonItem?.isEnabled = false
    let done = UIBarButtonItem(
      title: String(localized: "完成"),
      style: .prominent,
      target: self,
      action: #selector(endMTeamSelection)
    )
    done.accessibilityIdentifier = "mteam-select-done"
    navigationItem.rightBarButtonItems = [done]
    tabBarController?.setTabBarHidden(true, animated: false)
    configureMTeamSelectionToolbar()
  }

  @objc func endMTeamSelection() {
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

  func toggleMTeamSelection(_ torrent: MTeamTorrent) {
    mteamState.toggleSelection(for: torrent.id)
    updateMTeamSelectionToolbar()
  }

  func configureMTeamSelectionToolbar() {
    let count = UIBarButtonItem(title: String(localized: "已选择 0 项"), style: .plain, target: nil, action: nil)
    count.tag = 1
    let importItem = UIBarButtonItem(
      title: String(localized: "批量导入"),
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

  func updateMTeamSelectionToolbar() {
    let count = mteamState.selectedIDs.count
    toolbarItems?.first(where: { $0.tag == 1 })?.title = String(localized: "已选择 \(count) 项")
    toolbarItems?.first(where: { $0.tag == 2 })?.isEnabled = count > 0
  }

  @objc func presentMTeamBatchImport() {
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

  @objc func showMTeamFilters() {
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
}
