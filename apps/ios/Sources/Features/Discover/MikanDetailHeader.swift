import SwiftUI

enum MikanCover {
  static func url(from value: String?, baseURL: URL) -> URL? {
    guard let value, !value.isEmpty else { return nil }
    if let absolute = URL(string: value), absolute.scheme != nil {
      return absolute
    }
    return URL(string: value, relativeTo: baseURL)?.absoluteURL
  }
}

struct MikanDetailHeader: View {
  @Environment(\.openURL) private var openURL
  @Environment(AppModel.self) private var model
  @Environment(MikanDetailState.self) private var state

  let card: MikanBangumiCard
  let detail: MikanBangumiDetail
  let baseURL: URL

  var body: some View {
    MikanDetailMediaRow(spacing: AppSpacing.metrics, posterWidth: MikanDetailPosterMetrics.width) {
      MikanDetailPoster(url: coverURL)

      VStack(alignment: .leading, spacing: AppSpacing.related) {
        Text(resolvedTitle)
          .font(.title3.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)
          .lineLimit(3)
          .textSelection(.enabled)
          .accessibilityAddTraits(.isHeader)
          .accessibilityIdentifier("mikan-detail-title")

        VStack(alignment: .leading, spacing: AppSpacing.atomic) {
          Text(metadata)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          if let subjectID = detail.bangumiSubjectId {
            huggingRow {
              bangumiButton(subjectID)
            }
          }
        }

        if !detail.subgroups.isEmpty {
          huggingRow {
            subgroupMenu
          }
        }

        if let subscriptionBarVariant {
          MikanSubscriptionBarView(variant: subscriptionBarVariant)
            .accessibilityIdentifier("mikan-detail-subscription-status")
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }

  private var coverURL: URL? {
    MikanCover.url(from: detail.coverUrl ?? card.coverUrl, baseURL: baseURL)
  }

  private var resolvedTitle: String {
    detail.title.isEmpty ? card.title : detail.title
  }

  private var metadata: String {
    if let weekday = card.weekday {
      return "\(Self.weekdayName(weekday)) · Mikan"
    }
    return "Mikan"
  }

  private var actionSubgroup: MikanSubgroup? {
    if let selected = state.selectedSubgroupID {
      return detail.subgroups.first { $0.id == selected }
    }
    return detail.subgroups.first
  }

  private var subscriptionBarVariant: MikanSubscriptionBarVariant? {
    guard let subgroup = actionSubgroup else { return nil }
    guard
      let input = model.mikanSubscriptionBarInput(
        bangumiID: detail.bangumiId,
        subgroupID: subgroup.id
      )
    else { return nil }
    return MikanSubscriptionBarModel.build(input)
  }

  private var selectedSubgroupCaption: String {
    if state.selectedSubgroupID == nil {
      return "全部字幕组"
    }
    let subgroup = actionSubgroup
    if let name = subgroup?.name, !name.isEmpty {
      return name
    }
    return subgroup.map { "字幕组 \($0.id)" } ?? "字幕组"
  }

  private var subgroupMenu: some View {
    Menu {
      Button("全部字幕组") {
        state.selectedSubgroupID = nil
      }
      ForEach(detail.subgroups) { subgroup in
        Button(subgroup.name.isEmpty ? "字幕组 \(subgroup.id)" : subgroup.name) {
          state.selectedSubgroupID = subgroup.id
        }
      }
    } label: {
      HStack(spacing: AppSpacing.atomic) {
        Text(selectedSubgroupCaption)
        if detail.subgroups.count > 1 {
          Image(systemName: "chevron.up.chevron.down")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)
        }
      }
      .font(.subheadline)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(.fill.tertiary, in: Capsule())
    }
    .buttonStyle(.plain)
    .fixedSize()
    .contentShape(.rect)
    .accessibilityIdentifier("mikan-detail-subgroup")
    .accessibilityLabel("字幕组")
    .accessibilityValue(selectedSubgroupCaption)
  }

  private func bangumiButton(_ subjectID: String) -> some View {
    Button {
      guard let url = URL(string: "https://bgm.tv/subject/\(subjectID)") else { return }
      openURL(url)
    } label: {
      HStack(spacing: AppSpacing.atomic) {
        Text("在 Bangumi 查看")
        Image(systemName: "arrow.up.right")
          .font(.caption.weight(.semibold))
          .accessibilityHidden(true)
      }
      .font(.subheadline)
      .padding(.vertical, 4)
    }
    .buttonStyle(.borderless)
    .fixedSize()
    .contentShape(.rect)
    .accessibilityIdentifier("mikan-detail-bangumi")
    .accessibilityHint("在 Safari 中打开")
  }

  private func huggingRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    HStack(spacing: 0) {
      content()
      Spacer(minLength: 0)
    }
  }

  private static func weekdayName(_ weekday: Int) -> String {
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

struct MikanDetailHeroBackdrop: View {
  let url: URL?

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .top) {
        if !reduceTransparency {
          glow
            .frame(width: geometry.size.width, height: geometry.size.height)

          if let url {
            AsyncImage(url: url) { phase in
              if case .success(let image) = phase {
                image
                  .resizable()
                  .scaledToFill()
                  .frame(
                    width: geometry.size.width * 1.55,
                    height: geometry.size.height * 1.55
                  )
                  .blur(radius: 28, opaque: true)
                  .frame(width: geometry.size.width, height: geometry.size.height)
                  .clipped()
                  .modifier(MikanDetailImageReveal(scaleFrom: 1.08, duration: 0.78))
              }
            }
            .transaction { $0.animation = nil }
          }
        }

        LinearGradient(
          stops: [
            .init(
              color: Color.black.opacity(colorScheme == .dark && !reduceTransparency ? 0.1 : 0),
              location: 0
            ),
            .init(
              color: Color(.systemGroupedBackground).opacity(reduceTransparency ? 1 : 0.06),
              location: 0.32
            ),
            .init(color: Color(.systemGroupedBackground).opacity(0.42), location: 0.68),
            .init(color: Color(.systemGroupedBackground), location: 1),
          ],
          startPoint: .top,
          endPoint: .bottom
        )
      }
    }
    .frame(height: 340)
    .clipped()
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }

  private var glow: some View {
    RadialGradient(
      colors: [
        Color.accentColor.opacity(0.42),
        Color.accentColor.opacity(0.12),
        Color.clear,
      ],
      center: UnitPoint(x: 0.22, y: 0.08),
      startRadius: 8,
      endRadius: 260
    )
    .scaleEffect(1.35)
    .blur(radius: 22)
  }
}

private struct MikanDetailMediaRow: Layout {
  var spacing: CGFloat
  var posterWidth: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    guard subviews.count == 2 else {
      return proposal.replacingUnspecifiedDimensions()
    }
    let width = proposal.width ?? posterWidth
    let infoWidth = max(0, width - posterWidth - spacing)
    let posterSize = subviews[0].sizeThatFits(
      ProposedViewSize(width: posterWidth, height: nil)
    )
    let infoSize = subviews[1].sizeThatFits(
      ProposedViewSize(width: infoWidth, height: nil)
    )
    return CGSize(
      width: width,
      height: max(posterSize.height, infoSize.height, MikanDetailPosterMetrics.minHeight)
    )
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    guard subviews.count == 2 else { return }
    let infoWidth = max(0, bounds.width - posterWidth - spacing)
    subviews[0].place(
      at: bounds.origin,
      proposal: ProposedViewSize(width: posterWidth, height: bounds.height)
    )
    subviews[1].place(
      at: CGPoint(x: bounds.minX + posterWidth + spacing, y: bounds.minY),
      proposal: ProposedViewSize(width: infoWidth, height: bounds.height)
    )
  }
}

private struct MikanDetailImageReveal: ViewModifier {
  var scaleFrom: CGFloat
  var duration: Double

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var revealed = false

  func body(content: Content) -> some View {
    content
      .opacity(revealed ? 1 : 0)
      .scaleEffect(revealed ? 1 : scaleFrom)
      .onAppear(perform: reveal)
  }

  private func reveal() {
    if reduceMotion {
      revealed = true
      return
    }
    withAnimation(.smooth(duration: duration)) {
      revealed = true
    }
  }
}

private enum MikanDetailPosterMetrics {
  static let width: CGFloat = 104
  static let minHeight: CGFloat = 144
}

private struct MikanDetailPoster: View {
  let url: URL?

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(.quaternary)

      if let url {
        AsyncImage(url: url) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .scaledToFill()
              .modifier(MikanDetailImageReveal(scaleFrom: 1, duration: 0.56))
          case .failure:
            placeholder
          default:
            ProgressView()
          }
        }
        .transaction { $0.animation = nil }
      } else {
        placeholder
      }
    }
    .frame(
      minWidth: MikanDetailPosterMetrics.width,
      maxWidth: MikanDetailPosterMetrics.width,
      minHeight: MikanDetailPosterMetrics.minHeight,
      maxHeight: .infinity
    )
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .strokeBorder(.primary.opacity(0.1), lineWidth: 1)
    }
    .shadow(color: .black.opacity(0.28), radius: 10, y: 5)
    .accessibilityElement(children: .ignore)
    .accessibilityHidden(true)
    .allowsHitTesting(false)
  }

  private var placeholder: some View {
    Image(systemName: "sparkles.tv")
      .font(.title2)
      .foregroundStyle(.secondary)
      .accessibilityHidden(true)
  }
}

private struct MikanSubscriptionBarView: View {
  let variant: MikanSubscriptionBarVariant

  var body: some View {
    HStack(spacing: AppSpacing.atomic) {
      Circle()
        .fill(dotColor)
        .frame(width: 6, height: 6)
      Text(MikanSubscriptionBarModel.segments(for: variant, now: .now).joined(separator: " · "))
        .font(.caption)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .accessibilityElement(children: .combine)
  }

  private var dotColor: Color {
    switch variant {
    case .healthy: .green
    case .checkFailing: .red
    case .offline: .secondary
    case .needsRepairing: .orange
    }
  }
}
