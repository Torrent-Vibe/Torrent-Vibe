import SwiftUI
import UIKit

@MainActor
final class TorrentFilterPagingBridge {
  weak var tabsView: HorizontalTabsComponent.View?

  func clearTabsView(_ view: HorizontalTabsComponent.View) {
    if tabsView === view {
      tabsView = nil
    }
  }

  func updatePageOffset(_ offset: CGFloat, isDragging: Bool) {
    tabsView?.updateTabSwitchFraction(
      fraction: -min(1.0, max(-1.0, offset)),
      isDragging: isDragging,
      transition: .immediate
    )
  }

  func settle() {
    tabsView?.updateTabSwitchFraction(
      fraction: 0.0,
      isDragging: false,
      transition: .spring(duration: 0.35)
    )
  }
}

struct TorrentFilterPagerView: UIViewControllerRepresentable {
  let model: AppModel
  let selectionState: TorrentSelectionState
  let selection: TorrentFilter
  let query: String
  let pagingBridge: TorrentFilterPagingBridge
  let onSelectFilter: (TorrentFilter) -> Void
  let onOpenTorrent: (TorrentSummary) -> Void
  let onDeleteTorrent: (TorrentSummary) -> Void
  let onManageTorrent: (TorrentSummary) -> Void
  let onToggleSelection: (TorrentSummary) -> Void
  let onTogglePause: (TorrentSummary) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(parent: self)
  }

  func makeUIViewController(context: Context) -> UIPageViewController {
    let pageViewController = UIPageViewController(
      transitionStyle: .scroll,
      navigationOrientation: .horizontal
    )
    pageViewController.view.backgroundColor = .clear
    pageViewController.dataSource = context.coordinator
    pageViewController.delegate = context.coordinator

    context.coordinator.attach(to: pageViewController)
    context.coordinator.update(parent: self, animated: false)
    return pageViewController
  }

  func updateUIViewController(_ pageViewController: UIPageViewController, context: Context) {
    context.coordinator.update(parent: self, animated: true)
  }

  static func dismantleUIViewController(
    _ pageViewController: UIPageViewController,
    coordinator: Coordinator
  ) {
    coordinator.detach()
  }

  @MainActor
  final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
    private var parent: TorrentFilterPagerView
    private weak var pageViewController: UIPageViewController?
    private weak var pagingScrollView: UIScrollView?
    private var pages: [TorrentFilter: TorrentFilterPageHostingController] = [:]
    private var visibleFilter: TorrentFilter?
    private var isProgrammaticTransition = false
    private var progressDisplayLink: CADisplayLink?

    init(parent: TorrentFilterPagerView) {
      self.parent = parent
    }

    func attach(to pageViewController: UIPageViewController) {
      self.pageViewController = pageViewController
      if let scrollView = pageViewController.view.subviews.compactMap({ $0 as? UIScrollView }).first
      {
        pagingScrollView = scrollView
        scrollView.panGestureRecognizer.addTarget(self, action: #selector(pagePanChanged(_:)))
      }
    }

    func detach() {
      if let pagingScrollView {
        pagingScrollView.panGestureRecognizer.removeTarget(
          self, action: #selector(pagePanChanged(_:)))
      }
      stopProgressUpdates()
      pagingScrollView = nil
      pageViewController = nil
    }

    func update(parent: TorrentFilterPagerView, animated: Bool) {
      self.parent = parent
      updatePageRoots()

      guard let targetPage = pages[parent.selection] else { return }
      guard visibleFilter != parent.selection else { return }
      guard !isProgrammaticTransition else { return }

      let previousIndex = visibleFilter.flatMap { TorrentFilter.allCases.firstIndex(of: $0) }
      let targetIndex = TorrentFilter.allCases.firstIndex(of: parent.selection) ?? 0
      let direction: UIPageViewController.NavigationDirection =
        (previousIndex ?? targetIndex) <= targetIndex ? .forward : .reverse
      let shouldAnimate = animated && visibleFilter != nil

      isProgrammaticTransition = shouldAnimate
      pageViewController?.setViewControllers(
        [targetPage],
        direction: direction,
        animated: shouldAnimate
      ) { [weak self] completed in
        guard let self else { return }
        visibleFilter = parent.selection
        isProgrammaticTransition = false
        if completed {
          parent.pagingBridge.settle()
        }
      }
      if !shouldAnimate {
        visibleFilter = parent.selection
      }
    }

    func pageViewController(
      _ pageViewController: UIPageViewController,
      viewControllerBefore viewController: UIViewController
    ) -> UIViewController? {
      guard
        let page = viewController as? TorrentFilterPageHostingController,
        let index = TorrentFilter.allCases.firstIndex(of: page.filter),
        index > TorrentFilter.allCases.startIndex
      else { return nil }
      return pages[TorrentFilter.allCases[index - 1]]
    }

    func pageViewController(
      _ pageViewController: UIPageViewController,
      viewControllerAfter viewController: UIViewController
    ) -> UIViewController? {
      guard
        let page = viewController as? TorrentFilterPageHostingController,
        let index = TorrentFilter.allCases.firstIndex(of: page.filter),
        index < TorrentFilter.allCases.index(before: TorrentFilter.allCases.endIndex)
      else { return nil }
      return pages[TorrentFilter.allCases[index + 1]]
    }

    func pageViewController(
      _ pageViewController: UIPageViewController,
      willTransitionTo pendingViewControllers: [UIViewController]
    ) {
      startProgressUpdates()
    }

    func pageViewController(
      _ pageViewController: UIPageViewController,
      didFinishAnimating finished: Bool,
      previousViewControllers: [UIViewController],
      transitionCompleted completed: Bool
    ) {
      stopProgressUpdates()

      if completed,
        let page = pageViewController.viewControllers?.first as? TorrentFilterPageHostingController
      {
        visibleFilter = page.filter
        parent.onSelectFilter(page.filter)
      }
      parent.pagingBridge.settle()
    }

    @objc private func pagePanChanged(_ recognizer: UIPanGestureRecognizer) {
      switch recognizer.state {
      case .began, .changed:
        startProgressUpdates()
        updateInteractiveProgress()
      case .cancelled, .failed:
        stopProgressUpdates()
        parent.pagingBridge.settle()
      case .ended, .possible:
        break
      @unknown default:
        break
      }
    }

    @objc private func updateInteractiveProgress() {
      guard let pagingScrollView, pagingScrollView.bounds.width > 0.0 else { return }
      let offset =
        (pagingScrollView.contentOffset.x - pagingScrollView.bounds.width)
        / pagingScrollView.bounds.width
      parent.pagingBridge.updatePageOffset(
        offset,
        isDragging: pagingScrollView.isDragging || pagingScrollView.isDecelerating
      )
    }

    private func startProgressUpdates() {
      guard progressDisplayLink == nil else { return }
      let displayLink = CADisplayLink(target: self, selector: #selector(updateInteractiveProgress))
      progressDisplayLink = displayLink
      displayLink.add(to: .main, forMode: .common)
    }

    private func stopProgressUpdates() {
      progressDisplayLink?.invalidate()
      progressDisplayLink = nil
    }

    private func updatePageRoots() {
      for filter in TorrentFilter.allCases {
        let rootView = AnyView(
          TorrentFilterPageView(
            model: parent.model,
            selectionState: parent.selectionState,
            filter: filter,
            query: parent.query,
            onOpenTorrent: parent.onOpenTorrent,
            onDeleteTorrent: parent.onDeleteTorrent,
            onManageTorrent: parent.onManageTorrent,
            onToggleSelection: parent.onToggleSelection,
            onTogglePause: parent.onTogglePause
          )
        )

        if let page = pages[filter] {
          page.rootView = rootView
        } else {
          pages[filter] = TorrentFilterPageHostingController(filter: filter, rootView: rootView)
        }
      }
    }
  }
}

@MainActor
private final class TorrentFilterPageHostingController: UIHostingController<AnyView> {
  let filter: TorrentFilter

  init(filter: TorrentFilter, rootView: AnyView) {
    self.filter = filter
    super.init(rootView: rootView)
    view.backgroundColor = .clear
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

private struct TorrentFilterPageView: View {
  @Bindable var model: AppModel
  @Bindable var selectionState: TorrentSelectionState

  let filter: TorrentFilter
  let query: String
  let onOpenTorrent: (TorrentSummary) -> Void
  let onDeleteTorrent: (TorrentSummary) -> Void
  let onManageTorrent: (TorrentSummary) -> Void
  let onToggleSelection: (TorrentSummary) -> Void
  let onTogglePause: (TorrentSummary) -> Void

  private var filteredTorrents: [TorrentSummary] {
    let scoped = model.torrents.filter(filter.includes)
    let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedQuery.isEmpty else { return scoped }
    return scoped.filter { $0.name.localizedCaseInsensitiveContains(normalizedQuery) }
  }

  var body: some View {
    List {
      Section {
        if filteredTorrents.isEmpty {
          ContentUnavailableView {
            Label("当前范围没有任务", systemImage: filter.systemImage)
          } description: {
            Text("可更换状态范围或搜索关键词。")
          }
          .accessibilityIdentifier("torrent-filter-empty")
        } else {
          ForEach(filteredTorrents) { torrent in
            row(for: torrent)
          }
        }
      }
    }
    .listStyle(.insetGrouped)
    .listSectionSpacing(.compact)
    .contentMargins(.top, 48, for: .scrollContent)
    .scrollEdgeEffectStyle(.soft, for: .top)
    .refreshable {
      await model.refreshTorrents()
    }
  }

  private func row(for torrent: TorrentSummary) -> some View {
    Button {
      if selectionState.isSelecting {
        onToggleSelection(torrent)
      } else {
        onOpenTorrent(torrent)
      }
    } label: {
      TorrentRow(
        torrent: torrent,
        isSelecting: selectionState.isSelecting,
        isSelected: selectionState.selectedIDs.contains(torrent.id)
      )
    }
    .buttonStyle(.plain)
    .listRowInsets(EdgeInsets(top: 9, leading: 16, bottom: 9, trailing: 16))
    .accessibilityIdentifier("torrent-row-\(torrent.id)")
    .swipeActions(edge: .leading, allowsFullSwipe: true) {
      if !selectionState.isSelecting {
        Button {
          onTogglePause(torrent)
        } label: {
          Label(
            torrent.isPaused ? "继续" : "暂停",
            systemImage: torrent.isPaused ? "play.fill" : "pause.fill"
          )
        }
        .tint(torrent.isPaused ? .green : .orange)
      }
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      if !selectionState.isSelecting {
        Button(role: .destructive) {
          onDeleteTorrent(torrent)
        } label: {
          Label("删除", systemImage: "trash")
        }
      }
    }
    .contextMenu {
      if !selectionState.isSelecting {
        Button {
          onTogglePause(torrent)
        } label: {
          Label(
            torrent.isPaused ? "继续" : "暂停",
            systemImage: torrent.isPaused ? "play.fill" : "pause.fill"
          )
        }
        Button {
          onManageTorrent(torrent)
        } label: {
          Label("分类、标签与限速", systemImage: "slider.horizontal.3")
        }
        Divider()
        Button(role: .destructive) {
          onDeleteTorrent(torrent)
        } label: {
          Label("删除", systemImage: "trash")
        }
      }
    }
  }
}
