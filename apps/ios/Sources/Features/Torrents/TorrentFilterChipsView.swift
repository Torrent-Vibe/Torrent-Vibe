import SwiftUI
import UIKit

struct TorrentFilterTabsView: View {
  let counts: [TorrentFilter: Int]
  let selection: TorrentFilter
  let pagingBridge: TorrentFilterPagingBridge
  let onSelect: (TorrentFilter) -> Void

  var body: some View {
    TorrentFilterTabsRepresentable(
      counts: counts,
      selection: selection,
      pagingBridge: pagingBridge,
      onSelect: onSelect
    )
    .frame(height: 40)
  }
}

private struct TorrentFilterTabsRepresentable: UIViewRepresentable {
  let counts: [TorrentFilter: Int]
  let selection: TorrentFilter
  let pagingBridge: TorrentFilterPagingBridge
  let onSelect: (TorrentFilter) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIView(context: Context) -> HorizontalTabsComponent.View {
    let view = HorizontalTabsComponent.View()
    context.coordinator.pagingBridge = pagingBridge
    pagingBridge.tabsView = view
    return view
  }

  func updateUIView(_ view: HorizontalTabsComponent.View, context: Context) {
    let selectionChanged = context.coordinator.selection != selection
    let tabs = TorrentFilter.allCases.map { filter in
      let count = counts[filter, default: 0]
      return HorizontalTabsComponent.Tab(
        id: filter,
        content: .title(.init(text: filter.title)),
        badge: count > 0
          ? .init(title: "\(count)")
          : nil,
        accessibilityLabel: "任务状态筛选：\(filter.title)，\(count) 个",
        accessibilityIdentifier: "torrent-filter-chip-\(filter.rawValue)",
        action: { onSelect(filter) }
      )
    }

    view.update(
      component: HorizontalTabsComponent(
        tabs: tabs,
        selectedTab: selection,
        isEditing: false,
        layout: .fill,
        liftWhileSwitching: false,
        verticalInset: 0
      ),
      transition: selectionChanged ? .easeInOut(duration: 0.25) : .immediate
    )
    context.coordinator.selection = selection
  }

  static func dismantleUIView(_ view: HorizontalTabsComponent.View, coordinator: Coordinator) {
    coordinator.pagingBridge?.clearTabsView(view)
  }

  final class Coordinator {
    var selection: TorrentFilter?
    weak var pagingBridge: TorrentFilterPagingBridge?
  }
}
