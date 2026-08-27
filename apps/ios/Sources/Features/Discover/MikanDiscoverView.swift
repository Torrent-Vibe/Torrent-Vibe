import SwiftUI
import UIKit

extension DiscoverViewController {
  func loadInitialContent() async {
    guard state.provider == .mikan else { return }
    guard let runtime else {
      state.errorMessage = String(localized: "Mikan 内容解析不可用。")
      state.parserStatus = String(localized: "解析器不可用")
      return
    }

    if model.isDemoMode {
      do {
        let wall = try await runtime.parseSeasonWall(html: Self.demoSeasonHTML)
        apply(wall: wall, source: String(localized: "演示内容"))
      } catch {
        state.errorMessage = error.localizedDescription
      }
      return
    }

    guard let baseURL = configuredBaseURL() else { return }
    state.baseURL = baseURL
    await loadSeasonWall()
  }

  func loadSeasonWall() async {
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
      apply(wall: wall, source: String(localized: "实时内容"))
    } catch is CancellationError {
      return
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  func searchMikan(_ query: String) async {
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
      model.noteMikanCards(results)
      state.parserStatus = String(localized: "实时搜索 · JavaScriptCore Bridge v1 · \(results.count) 部番组")
    } catch is CancellationError {
      return
    } catch {
      state.searchResults = []
      state.errorMessage = error.localizedDescription
    }
  }

  func apply(wall: MikanSeasonWall, source: String) {
    state.seasonWall = wall
    model.noteMikanCards(wall.groups.flatMap(\.items))
    // Some Mikan responses omit the season heading even though the requested
    // wall is valid. Preserve the requested filter instead of presenting 0.
    if wall.year > 0 {
      state.selectedYear = wall.year
    }
    if !wall.season.isEmpty {
      state.selectedSeason = wall.season
    }
    let count = wall.groups.reduce(0) { $0 + $1.items.count }
    let status = String(localized: "\(source) · JavaScriptCore Bridge v1 · \(count) 部番组")
    state.parserStatus = status
    state.wallParserStatus = status
  }

  func configuredBaseURL() -> URL? {
    let value =
      defaults.string(forKey: "discover.mikan.baseURL")
      ?? "https://mikanani.me"
    guard
      let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
      ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
      url.host != nil
    else {
      state.errorMessage = String(localized: "请在设置中填写有效的 Mikan Base URL。")
      return nil
    }
    return url
  }

  func selectSeason(year: Int, season: String) {
    state.selectedYear = year
    state.selectedSeason = season
    searchTask?.cancel()
    searchTask = Task { await loadSeasonWall() }
  }

  func retryMikanRequest() {
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

  func showDetail(
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

  @objc func showSubscriptions() {
    navigationController?.pushViewController(
      SubscriptionsViewController(
        model: model,
        baseURL: configuredBaseURL()
      ) { [weak self] group in
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

struct MikanDiscoverContentView: View {
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
    case 0: String(localized: "星期日")
    case 1: String(localized: "星期一")
    case 2: String(localized: "星期二")
    case 3: String(localized: "星期三")
    case 4: String(localized: "星期四")
    case 5: String(localized: "星期五")
    case 6: String(localized: "星期六")
    default: String(localized: "特别放送")
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
