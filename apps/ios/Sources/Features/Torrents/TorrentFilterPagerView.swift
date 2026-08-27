import Observation
import SwiftUI
import UIKit

struct TorrentFilterPagerView: UIViewControllerRepresentable {
  let model: AppModel
  let selectionState: TorrentSelectionState
  let selection: TorrentFilter
  let query: String
  let onSelectFilter: (TorrentFilter) -> Void
  let onVisibleScrollViewChange: (UIScrollView?) -> Void
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
  final class Coordinator: NSObject, UIGestureRecognizerDelegate {
    private var parent: TorrentFilterPagerView
    private weak var pageViewController: UIPageViewController?
    private var pageSwipeRecognizers: [UISwipeGestureRecognizer] = []
    private var pages: [TorrentFilter: TorrentFilterPageViewController] = [:]
    private var visibleFilter: TorrentFilter?
    private var isProgrammaticTransition = false

    init(parent: TorrentFilterPagerView) {
      self.parent = parent
    }

    func attach(to pageViewController: UIPageViewController) {
      self.pageViewController = pageViewController
      if let scrollView = pageViewController.view.subviews.compactMap({ $0 as? UIScrollView }).first
      {
        scrollView.isScrollEnabled = false
      }
      let directions: [UISwipeGestureRecognizer.Direction] = [.left, .right]
      pageSwipeRecognizers = directions.map { direction in
        let recognizer = UISwipeGestureRecognizer(target: self, action: #selector(pageSwiped(_:)))
        recognizer.direction = direction
        recognizer.delegate = self
        pageViewController.view.addGestureRecognizer(recognizer)
        return recognizer
      }
    }

    func detach() {
      if let pageViewController {
        pageSwipeRecognizers.forEach(pageViewController.view.removeGestureRecognizer)
      }
      pageSwipeRecognizers = []
      parent.onVisibleScrollViewChange(nil)
      pageViewController = nil
    }

    func update(parent: TorrentFilterPagerView, animated: Bool) {
      self.parent = parent
      updatePages()

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
      ) { [weak self] _ in
        guard let self else { return }
        visibleFilter = parent.selection
        isProgrammaticTransition = false
        publishContentScrollView(for: targetPage)
      }
      if !shouldAnimate {
        visibleFilter = parent.selection
        publishContentScrollView(for: targetPage)
      }
    }

    @objc private func pageSwiped(_ recognizer: UISwipeGestureRecognizer) {
      guard
        let current = visibleFilter,
        let index = TorrentFilter.allCases.firstIndex(of: current)
      else { return }
      let targetIndex = recognizer.direction == .left ? index + 1 : index - 1
      guard TorrentFilter.allCases.indices.contains(targetIndex) else { return }
      parent.onSelectFilter(TorrentFilter.allCases[targetIndex])
    }

    func gestureRecognizer(
      _ gestureRecognizer: UIGestureRecognizer,
      shouldReceive touch: UITouch
    ) -> Bool {
      var view = touch.view
      while let current = view {
        // A row swipe belongs to UITableView; page swipes start in the grouped-list gutter.
        if current is UITableViewCell { return false }
        view = current.superview
      }
      return true
    }

    private func publishContentScrollView(for page: TorrentFilterPageViewController) {
      page.loadViewIfNeeded()
      page.prioritizePageSwipes(pageSwipeRecognizers)
      parent.onVisibleScrollViewChange(page.tableView)
    }

    private func updatePages() {
      for filter in TorrentFilter.allCases {
        if let page = pages[filter] {
          page.update(
            query: parent.query,
            onOpenTorrent: parent.onOpenTorrent,
            onDeleteTorrent: parent.onDeleteTorrent,
            onManageTorrent: parent.onManageTorrent,
            onToggleSelection: parent.onToggleSelection,
            onTogglePause: parent.onTogglePause
          )
        } else {
          pages[filter] = TorrentFilterPageViewController(
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
        }
      }
    }
  }
}

@MainActor
private final class TorrentFilterPageViewController: UIViewController {
  let filter: TorrentFilter
  let tableView = UITableView(frame: .zero, style: .insetGrouped)

  private let model: AppModel
  private let selectionState: TorrentSelectionState
  private var query: String
  private var torrents: [TorrentSummary] = []
  private var hasAppliedState = false
  private var isSelecting = false
  private var selectedIDs = Set<String>()
  private var hasPrioritizedPageSwipes = false
  private var onOpenTorrent: (TorrentSummary) -> Void
  private var onDeleteTorrent: (TorrentSummary) -> Void
  private var onManageTorrent: (TorrentSummary) -> Void
  private var onToggleSelection: (TorrentSummary) -> Void
  private var onTogglePause: (TorrentSummary) -> Void

  init(
    model: AppModel,
    selectionState: TorrentSelectionState,
    filter: TorrentFilter,
    query: String,
    onOpenTorrent: @escaping (TorrentSummary) -> Void,
    onDeleteTorrent: @escaping (TorrentSummary) -> Void,
    onManageTorrent: @escaping (TorrentSummary) -> Void,
    onToggleSelection: @escaping (TorrentSummary) -> Void,
    onTogglePause: @escaping (TorrentSummary) -> Void
  ) {
    self.model = model
    self.selectionState = selectionState
    self.filter = filter
    self.query = query
    self.onOpenTorrent = onOpenTorrent
    self.onDeleteTorrent = onDeleteTorrent
    self.onManageTorrent = onManageTorrent
    self.onToggleSelection = onToggleSelection
    self.onTogglePause = onTogglePause
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground

    tableView.translatesAutoresizingMaskIntoConstraints = false
    tableView.backgroundColor = .systemGroupedBackground
    tableView.dataSource = self
    tableView.delegate = self
    tableView.contentInsetAdjustmentBehavior = .never
    tableView.rowHeight = UITableView.automaticDimension
    tableView.estimatedRowHeight = 64
    tableView.topEdgeEffect.style = .soft
    tableView.register(TorrentRowCell.self, forCellReuseIdentifier: TorrentRowCell.reuseIdentifier)
    tableView.accessibilityIdentifier = "torrent-list-\(filter.rawValue)"

    let refreshControl = UIRefreshControl()
    refreshControl.accessibilityIdentifier = "torrent-refresh-control"
    refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)
    tableView.refreshControl = refreshControl

    view.addSubview(tableView)
    NSLayoutConstraint.activate([
      tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      tableView.topAnchor.constraint(equalTo: view.topAnchor),
      tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    observeState()
  }

  func update(
    query: String,
    onOpenTorrent: @escaping (TorrentSummary) -> Void,
    onDeleteTorrent: @escaping (TorrentSummary) -> Void,
    onManageTorrent: @escaping (TorrentSummary) -> Void,
    onToggleSelection: @escaping (TorrentSummary) -> Void,
    onTogglePause: @escaping (TorrentSummary) -> Void
  ) {
    self.onOpenTorrent = onOpenTorrent
    self.onDeleteTorrent = onDeleteTorrent
    self.onManageTorrent = onManageTorrent
    self.onToggleSelection = onToggleSelection
    self.onTogglePause = onTogglePause
    guard self.query != query else { return }
    self.query = query
    guard isViewLoaded else { return }
    applyCurrentState()
  }

  func prioritizePageSwipes(_ pageSwipes: [UISwipeGestureRecognizer]) {
    guard !hasPrioritizedPageSwipes else { return }
    let rowPans =
      tableView.gestureRecognizers?
      .compactMap { $0 as? UIPanGestureRecognizer }
      .filter { $0 !== tableView.panGestureRecognizer } ?? []
    for rowPan in rowPans {
      for pageSwipe in pageSwipes {
        rowPan.require(toFail: pageSwipe)
      }
    }
    hasPrioritizedPageSwipes = true
  }

  @objc private func refresh() {
    Task { [weak self] in
      guard let self else { return }
      await model.refreshTorrents()
      tableView.refreshControl?.endRefreshing()
    }
  }

  private func observeState() {
    withObservationTracking {
      applyCurrentState()
    } onChange: { [weak self] in
      Task { @MainActor in
        self?.observeState()
      }
    }
  }

  private func applyCurrentState() {
    let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
    let filtered = model.torrents.filter { torrent in
      filter.includes(torrent)
        && (normalizedQuery.isEmpty
          || torrent.name.localizedCaseInsensitiveContains(normalizedQuery))
    }
    let nextIsSelecting = selectionState.isSelecting
    let nextSelectedIDs = selectionState.selectedIDs
    guard
      !hasAppliedState || filtered != torrents || nextIsSelecting != isSelecting
        || nextSelectedIDs != selectedIDs
    else { return }

    hasAppliedState = true
    torrents = filtered
    isSelecting = nextIsSelecting
    selectedIDs = nextSelectedIDs
    tableView.reloadData()
    updateContentUnavailableConfiguration()
  }

  private func updateContentUnavailableConfiguration() {
    guard torrents.isEmpty else {
      contentUnavailableConfiguration = nil
      return
    }
    var configuration = UIContentUnavailableConfiguration.empty()
    configuration.image = UIImage(systemName: filter.systemImage)
    configuration.text = "当前范围没有任务"
    configuration.secondaryText = "可更换状态范围或搜索关键词。"
    contentUnavailableConfiguration = configuration
  }

  private func torrent(at indexPath: IndexPath) -> TorrentSummary? {
    torrents.indices.contains(indexPath.row) ? torrents[indexPath.row] : nil
  }

  private func togglePauseAction(for torrent: TorrentSummary) -> UIAction {
    UIAction(
      title: torrent.isPaused ? "继续" : "暂停",
      image: UIImage(systemName: torrent.isPaused ? "play.fill" : "pause.fill")
    ) { [weak self] _ in
      self?.onTogglePause(torrent)
    }
  }
}

extension TorrentFilterPageViewController: UITableViewDataSource, UITableViewDelegate {
  func tableView(_ tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? {
    UIView()
  }

  func tableView(_ tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat {
    .leastNormalMagnitude
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    torrents.count
  }

  func tableView(
    _ tableView: UITableView,
    cellForRowAt indexPath: IndexPath
  ) -> UITableViewCell {
    guard
      let torrent = torrent(at: indexPath),
      let cell = tableView.dequeueReusableCell(
        withIdentifier: TorrentRowCell.reuseIdentifier,
        for: indexPath
      ) as? TorrentRowCell
    else { return UITableViewCell() }

    cell.update(
      torrent: torrent,
      isSelecting: isSelecting,
      isMarked: selectedIDs.contains(torrent.id)
    )
    return cell
  }

  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard let torrent = torrent(at: indexPath) else { return }
    if isSelecting {
      onToggleSelection(torrent)
    } else {
      onOpenTorrent(torrent)
    }
  }

  func tableView(
    _ tableView: UITableView,
    leadingSwipeActionsConfigurationForRowAt indexPath: IndexPath
  ) -> UISwipeActionsConfiguration? {
    guard !isSelecting, let torrent = torrent(at: indexPath) else { return nil }
    let action = UIContextualAction(
      style: .normal,
      title: torrent.isPaused ? "继续" : "暂停"
    ) { [weak self] _, _, completion in
      self?.onTogglePause(torrent)
      completion(true)
    }
    action.image = UIImage(systemName: torrent.isPaused ? "play.fill" : "pause.fill")
    action.backgroundColor = torrent.isPaused ? .systemGreen : .systemOrange
    let configuration = UISwipeActionsConfiguration(actions: [action])
    configuration.performsFirstActionWithFullSwipe = true
    return configuration
  }

  func tableView(
    _ tableView: UITableView,
    trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath
  ) -> UISwipeActionsConfiguration? {
    guard !isSelecting, let torrent = torrent(at: indexPath) else { return nil }
    let action = UIContextualAction(style: .destructive, title: "删除") {
      [weak self] _, _, completion in
      self?.onDeleteTorrent(torrent)
      completion(true)
    }
    action.image = UIImage(systemName: "trash")
    let configuration = UISwipeActionsConfiguration(actions: [action])
    configuration.performsFirstActionWithFullSwipe = false
    return configuration
  }

  func tableView(
    _ tableView: UITableView,
    contextMenuConfigurationForRowAt indexPath: IndexPath,
    point: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard !isSelecting, let torrent = torrent(at: indexPath) else { return nil }
    return UIContextMenuConfiguration(actionProvider: { [weak self] _ in
      guard let self else { return nil }
      let manage = UIAction(
        title: "分类、标签与限速",
        image: UIImage(systemName: "slider.horizontal.3")
      ) { [weak self] _ in
        self?.onManageTorrent(torrent)
      }
      let delete = UIAction(
        title: "删除",
        image: UIImage(systemName: "trash"),
        attributes: .destructive
      ) { [weak self] _ in
        self?.onDeleteTorrent(torrent)
      }
      return UIMenu(children: [self.togglePauseAction(for: torrent), manage, delete])
    })
  }
}
