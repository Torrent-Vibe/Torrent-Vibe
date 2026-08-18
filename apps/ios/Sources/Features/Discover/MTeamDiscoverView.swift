import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class MTeamDiscoverState {
  var errorMessage: String?
  var filters: MTeamSearchFilters
  var hasMore = false
  var isLoading = false
  var items: [MTeamTorrent] = []
  var page = 0
  var query = ""
  var isSelecting = false
  var selectedIDs = Set<String>()
  var submittedQuery = ""
  var total = 0

  init(defaults: UserDefaults = .standard) {
    filters = MTeamSearchFilters(
      categories: [],
      discount: nil,
      mode: defaults.string(forKey: "discover.mteam.mode") ?? "normal"
    )
  }

  var filterSummary: String {
    var values = [MTeamDisplay.modeLabel(filters.mode)]
    if let discount = filters.discount {
      values.append(MTeamDisplay.discountLabel(discount))
    }
    if !filters.categories.isEmpty {
      values.append("分类 \(filters.categories.map(String.init).joined(separator: ", "))")
    }
    return values.joined(separator: " · ")
  }

  func beginSelection() {
    selectedIDs.removeAll()
    isSelecting = true
  }

  func endSelection() {
    selectedIDs.removeAll()
    isSelecting = false
  }

  func toggleSelection(for torrentID: String) {
    if selectedIDs.contains(torrentID) {
      selectedIDs.remove(torrentID)
    } else {
      selectedIDs.insert(torrentID)
    }
  }
}

struct MTeamDiscoverContentView: View {
  @Environment(MTeamDiscoverState.self) private var state

  let onLoadMore: () -> Void
  let onOpenTorrent: (MTeamTorrent) -> Void
  let onRetry: () -> Void
  let onSubmitSearch: () -> Void
  let onToggleSelection: (MTeamTorrent) -> Void

  var body: some View {
    List {
      if let errorMessage = state.errorMessage {
        Section {
          HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
              .foregroundStyle(.orange)
            Text(errorMessage)
              .font(.footnote)
            Spacer()
            Button("重试", action: onRetry)
          }
        }
      }

      if !state.items.isEmpty {
        Section {
          ForEach(state.items) { item in
            Button {
              if state.isSelecting {
                onToggleSelection(item)
              } else {
                onOpenTorrent(item)
              }
            } label: {
              HStack(spacing: 12) {
                if state.isSelecting {
                  Image(
                    systemName: state.selectedIDs.contains(item.id)
                      ? "checkmark.circle.fill" : "circle"
                  )
                  .font(.title3)
                  .foregroundStyle(
                    state.selectedIDs.contains(item.id) ? Color.accentColor : .secondary
                  )
                  .accessibilityHidden(true)
                }
                MTeamTorrentRow(torrent: item)
              }
            }
            .buttonStyle(.plain)
            .listRowInsets(.vertical, AppSpacing.related)
            .accessibilityIdentifier("mteam-result-\(item.id)")
            .accessibilityValue(
              state.isSelecting
                ? (state.selectedIDs.contains(item.id) ? "已选择" : "未选择") : ""
            )
          }
        } header: {
          HStack {
            Text("搜索结果")
            Spacer()
            Text("\(state.total) 条 · \(state.filterSummary)")
              .font(.caption)
              .textCase(nil)
          }
        }

        if state.hasMore {
          Section {
            Button {
              onLoadMore()
            } label: {
              HStack {
                Spacer()
                if state.isLoading {
                  ProgressView()
                } else {
                  Label("加载更多", systemImage: "arrow.down.circle")
                }
                Spacer()
              }
            }
            .disabled(state.isLoading)
            .accessibilityIdentifier("mteam-load-more")
          }
        }
      }
    }
    .overlay {
      if state.isLoading, state.items.isEmpty {
        ProgressView("正在搜索 M-Team")
      } else if state.items.isEmpty, state.errorMessage == nil {
        ContentUnavailableView {
          Label(
            state.submittedQuery.isEmpty ? "搜索 M-Team" : "没有找到 Torrent",
            systemImage: "magnifyingglass"
          )
        } description: {
          Text(
            state.submittedQuery.isEmpty
              ? "输入关键词并点击键盘上的“搜索”；Tracker 不会在每次输入时请求。"
              : "尝试更换关键词或调整筛选条件。"
          )
        } actions: {
          if state.submittedQuery.isEmpty {
            Button("搜索", action: onSubmitSearch)
              .disabled(state.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
              .accessibilityIdentifier("mteam-submit-search")
          }
        }
      }
    }
    .refreshable {
      if !state.submittedQuery.isEmpty {
        onRetry()
      }
    }
  }
}

private struct MTeamTorrentRow: View {
  let torrent: MTeamTorrent

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(torrent.title)
          .font(.body.weight(.medium))
          .foregroundStyle(.primary)
          .multilineTextAlignment(.leading)
          .lineLimit(3)
        Spacer(minLength: 4)
        if let discount = torrent.discount {
          MTeamDiscountBadge(discount: discount)
        }
      }

      if let synopsis = torrent.synopsis {
        Text(synopsis)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }

      HStack(spacing: 12) {
        if let category = torrent.category {
          Label(category, systemImage: "tag")
        }
        if let sizeBytes = torrent.sizeBytes {
          Label(MTeamDisplay.size(sizeBytes), systemImage: "externaldrive")
        }
        if let createdAt = torrent.createdAt {
          Text(createdAt, format: .dateTime.month().day())
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
      .lineLimit(1)

      CompactMetricStrip(items: metricItems(for: torrent, includesSize: false))
        .font(.caption)
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }

  private func metricItems(
    for torrent: MTeamTorrent,
    includesSize: Bool
  ) -> [CompactMetricItem] {
    MTeamDisplay.metricItems(for: torrent, includesSize: includesSize)
  }
}

private struct MTeamDiscountBadge: View {
  let discount: String

  var body: some View {
    Text(MTeamDisplay.discountLabel(discount))
      .font(.caption2.weight(.semibold))
      .foregroundStyle(.green)
      .padding(.horizontal, 6)
      .padding(.vertical, 2)
      .background(.green.opacity(0.13), in: Capsule())
      .fixedSize()
  }
}

final class MTeamFilterViewController: SwiftUIHostingViewController {
  private let filters: MTeamSearchFilters
  private var onApply: ((MTeamSearchFilters) -> Void)?

  init(filters: MTeamSearchFilters) {
    self.filters = filters
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "M-Team 筛选"
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(
      MTeamFilterContentView(
        filters: filters,
        onApply: { [weak self] filters in
          self?.dismiss(animated: true) {
            self?.onApply?(filters)
          }
        },
        onCancel: { [weak self] in
          self?.dismiss(animated: true)
        }
      )
    )
  }

  static func present(
    from presenter: UIViewController,
    filters: MTeamSearchFilters,
    onApply: @escaping (MTeamSearchFilters) -> Void
  ) {
    let controller = MTeamFilterViewController(filters: filters)
    controller.onApply = onApply
    let navigationController = UINavigationController(rootViewController: controller)
    navigationController.modalPresentationStyle = .pageSheet
    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.selectedDetentIdentifier = .medium
      sheet.prefersGrabberVisible = true
    }
    presenter.present(navigationController, animated: true)
  }
}

private struct MTeamFilterContentView: View {
  @State private var categoriesText: String
  @State private var discount: String
  @State private var mode: String

  let onApply: (MTeamSearchFilters) -> Void
  let onCancel: () -> Void

  init(
    filters: MTeamSearchFilters,
    onApply: @escaping (MTeamSearchFilters) -> Void,
    onCancel: @escaping () -> Void
  ) {
    _categoriesText = State(
      initialValue: filters.categories.map(String.init).joined(separator: ", ")
    )
    _discount = State(initialValue: filters.discount ?? "any")
    _mode = State(initialValue: filters.mode)
    self.onApply = onApply
    self.onCancel = onCancel
  }

  var body: some View {
    Form {
      Section("搜索范围") {
        Picker("模式", selection: $mode) {
          ForEach(MTeamDisplay.modes, id: \.value) { option in
            Text(option.label).tag(option.value)
          }
        }
        Picker("优惠", selection: $discount) {
          ForEach(MTeamDisplay.discounts, id: \.value) { option in
            Text(option.label).tag(option.value)
          }
        }
        TextField("分类 ID，例如 401, 405", text: $categoriesText)
          .keyboardType(.numbersAndPunctuation)
          .accessibilityIdentifier("mteam-filter-categories")
      }

      Section {
        Button("应用筛选") {
          onApply(
            MTeamSearchFilters(
              categories: categories,
              discount: discount == "any" ? nil : discount,
              mode: mode
            )
          )
        }
        .accessibilityIdentifier("mteam-filter-apply")
        Button("取消", role: .cancel, action: onCancel)
      } footer: {
        Text("筛选仅在用户提交搜索时发送；分类 ID 留空表示全部分类。")
      }
    }
  }

  private var categories: [Int] {
    categoriesText.split(separator: ",").compactMap { value in
      Int(value.trimmingCharacters(in: .whitespacesAndNewlines))
    }
  }
}

@MainActor
@Observable
private final class MTeamDetailState {
  var detail: MTeamTorrentDetail?
  var errorMessage: String?
  var isLoading = true
  var isPreparingImport = false
}

final class MTeamDetailViewController: SwiftUIHostingViewController {
  private let configuration: MTeamProviderConfiguration
  private let model: AppModel
  private let service: any MTeamService
  private let state = MTeamDetailState()
  private let torrent: MTeamTorrent

  init(
    torrent: MTeamTorrent,
    configuration: MTeamProviderConfiguration,
    service: any MTeamService,
    model: AppModel
  ) {
    self.torrent = torrent
    self.configuration = configuration
    self.service = service
    self.model = model
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "Torrent 详情"
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "导入",
      style: .prominent,
      target: self,
      action: #selector(importTorrent)
    )
    navigationItem.rightBarButtonItem?.isEnabled = false
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "mteam-detail-import"
    host(
      MTeamDetailContentView(
        fallback: torrent,
        onRetry: { [weak self] in
          Task { await self?.loadDetail() }
        }
      )
      .environment(model)
      .environment(state)
    )
    Task { await loadDetail() }
  }

  @objc private func importTorrent() {
    guard !state.isPreparingImport else { return }
    state.isPreparingImport = true
    navigationItem.rightBarButtonItem?.isEnabled = false

    Task { [weak self] in
      guard let self else { return }
      do {
        let url = try await service.downloadURL(
          configuration: configuration,
          torrentID: torrent.id
        )
        state.isPreparingImport = false
        updateImportAvailability()
        TorrentImportViewController.present(
          from: self,
          model: model,
          draft: TorrentImportDraft(
            displayTitle: state.detail?.torrent.title ?? torrent.title,
            locksSource: true,
            sourceText: url.absoluteString,
            sourceFooterText: "此临时 Torrent 链接由 M-Team 生成；确认目标服务器后再提交。"
          )
        ) { [weak self] server in
          guard let self else { return }
          TorrentImportViewController.presentSuccess(on: self, server: server)
        }
      } catch {
        state.isPreparingImport = false
        updateImportAvailability()
        presentError(error.localizedDescription)
      }
    }
  }

  private func loadDetail() async {
    state.isLoading = true
    state.errorMessage = nil
    navigationItem.rightBarButtonItem?.isEnabled = false
    defer {
      state.isLoading = false
      updateImportAvailability()
    }
    do {
      let detail = try await service.detail(
        configuration: configuration,
        torrent: torrent
      )
      state.detail = detail
      title = detail.torrent.title
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  private func updateImportAvailability() {
    navigationItem.rightBarButtonItem?.isEnabled =
      state.detail != nil && model.activeServer != nil && !state.isPreparingImport
  }

  private func presentError(_ message: String) {
    let alert = UIAlertController(
      title: "无法准备 Torrent",
      message: message,
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "好", style: .default))
    present(alert, animated: true)
  }
}

private struct MTeamDetailContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MTeamDetailState.self) private var state

  let fallback: MTeamTorrent
  let onRetry: () -> Void

  var body: some View {
    Group {
      if let detail = state.detail {
        List {
          Section {
            header(detail.torrent)
          }

          if let description = detail.description ?? detail.torrent.synopsis {
            Section("简介") {
              Text(description)
                .textSelection(.enabled)
            }
          }

          if !detail.screenshots.isEmpty {
            Section("截图") {
              ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                  ForEach(detail.screenshots, id: \.self) { url in
                    AsyncImage(url: url) { phase in
                      if let image = phase.image {
                        image
                          .resizable()
                          .scaledToFill()
                      } else {
                        ZStack {
                          Color.secondary.opacity(0.08)
                          ProgressView()
                        }
                      }
                    }
                    .frame(width: 260, height: 146)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                  }
                }
              }
              .scrollIndicators(.hidden)
            }
          }

          if !detail.files.isEmpty {
            Section("文件") {
              ForEach(detail.files) { file in
                LabeledContent {
                  Text(file.sizeBytes.map(MTeamDisplay.size) ?? "—")
                } label: {
                  Label(file.name, systemImage: "doc")
                }
              }
            }
          }

          if let mediaInfo = detail.mediaInfo, !mediaInfo.isEmpty {
            Section("媒体信息") {
              Text(mediaInfo)
                .font(.caption.monospaced())
                .textSelection(.enabled)
            }
          }

          if detail.torrent.imdbURL != nil || detail.torrent.doubanURL != nil {
            Section("外部链接") {
              if let imdbURL = detail.torrent.imdbURL {
                Link("在 IMDb 查看", destination: imdbURL)
              }
              if let doubanURL = detail.torrent.doubanURL {
                Link("在豆瓣查看", destination: doubanURL)
              }
            }
          }
        }
        .safeAreaInset(edge: .bottom) {
          if model.activeServer == nil {
            Label("配置服务器后可导入", systemImage: "externaldrive.badge.exclamationmark")
              .font(.footnote)
              .foregroundStyle(.secondary)
              .padding(10)
              .frame(maxWidth: .infinity)
              .background(.bar)
          } else if state.isPreparingImport {
            ProgressView("正在生成临时 Torrent 链接")
              .font(.footnote)
              .padding(10)
              .frame(maxWidth: .infinity)
              .background(.bar)
          }
        }
      } else if state.isLoading {
        ProgressView("正在载入 M-Team 详情")
      } else {
        ContentUnavailableView {
          Label("无法载入 Torrent 详情", systemImage: "exclamationmark.triangle")
        } description: {
          Text(state.errorMessage ?? "未知错误")
        } actions: {
          Button("重试", action: onRetry)
        }
      }
    }
  }

  private func header(_ torrent: MTeamTorrent) -> some View {
    VStack(alignment: .leading, spacing: AppSpacing.group) {
      VStack(alignment: .leading, spacing: AppSpacing.atomic) {
        HStack(alignment: .firstTextBaseline, spacing: AppSpacing.related) {
          Text(torrent.title)
            .font(.title3.weight(.semibold))
            .fixedSize(horizontal: false, vertical: true)
            .layoutPriority(1)
            .accessibilityIdentifier("mteam-detail-title")

          if let discount = torrent.discount {
            MTeamDiscountBadge(discount: discount)
              .accessibilityIdentifier("mteam-detail-discount")
          }
        }

        if let synopsis = torrent.synopsis {
          Text(synopsis)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }

      CompactMetricStrip(items: MTeamDisplay.metricItems(for: torrent, includesSize: true))
        .font(.caption)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mteam-detail-metrics")
    }
    .listRowInsets(.vertical, AppSpacing.related)
  }
}

enum MTeamDisplay {
  static let modes = [
    (value: "normal", label: "常规"),
    (value: "movie", label: "电影"),
    (value: "tv", label: "电视"),
    (value: "music", label: "音乐"),
    (value: "adult", label: "成人"),
  ]

  static let discounts = [
    (value: "any", label: "全部"),
    (value: "FREE", label: "免费"),
    (value: "PERCENT_50", label: "五折"),
    (value: "PERCENT_30", label: "三折"),
    (value: "_2X", label: "上传 ×2"),
    (value: "_2X_FREE", label: "上传 ×2 + 免费"),
    (value: "_2X_PERCENT_50", label: "上传 ×2 + 五折"),
  ]

  static func discountLabel(_ value: String) -> String {
    discounts.first { $0.value == value }?.label ?? value
  }

  static func modeLabel(_ value: String) -> String {
    modes.first { $0.value == value }?.label ?? value
  }

  static func metricItems(
    for torrent: MTeamTorrent,
    includesSize: Bool
  ) -> [CompactMetricItem] {
    var items: [CompactMetricItem] = []
    if includesSize, let sizeBytes = torrent.sizeBytes {
      items.append(
        CompactMetricItem(
          accessibilityTitle: "大小",
          id: "size",
          systemImage: "externaldrive",
          value: size(sizeBytes)
        )
      )
    }
    items.append(
      CompactMetricItem(
        accessibilityTitle: "做种数",
        id: "seeders",
        systemImage: "arrow.up.circle",
        value: torrent.seeders.map(String.init) ?? "—"
      )
    )
    items.append(
      CompactMetricItem(
        accessibilityTitle: "下载数",
        id: "leechers",
        systemImage: "arrow.down.circle",
        value: torrent.leechers.map(String.init) ?? "—"
      )
    )
    items.append(
      CompactMetricItem(
        accessibilityTitle: "完成数",
        id: "snatches",
        systemImage: "checkmark.circle",
        value: torrent.snatches.map(String.init) ?? "—"
      )
    )
    return items
  }

  static func size(_ bytes: Int64) -> String {
    ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
  }
}
