import SwiftUI
import UIKit

struct TorrentFilterTabsView: View {
  let counts: [TorrentFilter: Int]
  let selection: TorrentFilter
  let onSelect: (TorrentFilter) -> Void

  var body: some View {
    TorrentFilterTabsRepresentable(
      counts: counts,
      selection: selection,
      onSelect: onSelect
    )
    .frame(height: 40)
  }
}

private struct TorrentFilterTabsRepresentable: UIViewRepresentable {
  let counts: [TorrentFilter: Int]
  let selection: TorrentFilter
  let onSelect: (TorrentFilter) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIView(context: Context) -> HorizontalTabsComponent.View {
    HorizontalTabsComponent.View()
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
        accessibilityLabel: String(localized: "任务状态筛选：\(filter.title)，\(count) 个"),
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

  final class Coordinator {
    var selection: TorrentFilter?
  }
}
