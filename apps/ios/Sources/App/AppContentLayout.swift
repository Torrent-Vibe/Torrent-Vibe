import SwiftUI

enum AppSpacing {
  static let atomic: CGFloat = 4
  static let related: CGFloat = 8
  static let group: CGFloat = 12
  static let metrics: CGFloat = 16
  static let section: CGFloat = 20

  static let compactMetricIconWidth: CGFloat = 18
}

struct CompactMetricItem: Identifiable {
  let accessibilityTitle: String
  let id: String
  let systemImage: String
  let value: String
  var color: Color = .secondary
}

struct CompactMetric: View {
  let item: CompactMetricItem

  var body: some View {
    HStack(spacing: AppSpacing.atomic) {
      Image(systemName: item.systemImage)
        .frame(width: AppSpacing.compactMetricIconWidth)
      Text(item.value)
        .monospacedDigit()
    }
    .foregroundStyle(item.color)
    .fixedSize(horizontal: true, vertical: false)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(item.accessibilityTitle)
    .accessibilityValue(item.value)
  }
}

struct CompactMetricStrip: View {
  let items: [CompactMetricItem]

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(spacing: AppSpacing.metrics) {
        metricItems(items)
      }

      Grid(
        alignment: .leading,
        horizontalSpacing: AppSpacing.metrics,
        verticalSpacing: AppSpacing.related
      ) {
        GridRow {
          metricItems(Array(items.prefix(firstRowCount)))
        }
        if items.count > firstRowCount {
          GridRow {
            metricItems(Array(items.dropFirst(firstRowCount)))
          }
        }
      }
    }
  }

  private var firstRowCount: Int {
    (items.count + 1) / 2
  }

  @ViewBuilder
  private func metricItems(_ items: [CompactMetricItem]) -> some View {
    ForEach(items) { item in
      CompactMetric(item: item)
    }
  }
}
