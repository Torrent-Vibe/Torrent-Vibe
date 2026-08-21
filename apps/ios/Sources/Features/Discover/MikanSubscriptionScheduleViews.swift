import SwiftUI

enum SubscriptionScope: Equatable {
  case all
  case day(Int)
}

struct SubscriptionWeekStrip: View {
  let sections: [SubscriptionDaySection]
  let daysWithNewEpisodes: Set<Int>
  @Binding var selection: SubscriptionScope

  private static let dayCharacters = ["日", "一", "二", "三", "四", "五", "六"]

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 6) {
        allButton
        ForEach(sections) { section in
          dayButton(section)
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
    }
    .accessibilityIdentifier("subscription-week-strip")
  }

  private var allButton: some View {
    Button {
      selection = .all
    } label: {
      Text("全部")
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Capsule().fill(selection == .all ? Color.accentColor.opacity(0.14) : .clear))
        .foregroundStyle(selection == .all ? Color.accentColor : .secondary)
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("subscription-scope-all")
    .accessibilityLabel("全部订阅")
  }

  private func dayButton(_ section: SubscriptionDaySection) -> some View {
    let isSelected = selection == .day(section.mikanWeekday)
    return Button {
      selection = .day(section.mikanWeekday)
    } label: {
      VStack(spacing: 3) {
        Text(Self.dayCharacters[section.mikanWeekday])
          .font(.caption2.weight(.medium))
          .foregroundStyle(isSelected ? Color.white.opacity(0.9) : .secondary)
        Text("\(Calendar.current.component(.day, from: section.date))")
          .font(.subheadline.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(isSelected ? Color.white : .primary)
      }
      .frame(width: 34, height: 40)
      .background {
        Circle()
          .fill(isSelected ? Color.accentColor : .clear)
          .frame(width: 38, height: 38)
      }
      .overlay(alignment: .topTrailing) {
        if daysWithNewEpisodes.contains(section.mikanWeekday) {
          Circle()
            .fill(Color.accentColor)
            .frame(width: 6, height: 6)
            .offset(x: 2, y: -2)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("subscription-scope-day-\(section.mikanWeekday)")
    .accessibilityLabel("周\(Self.dayCharacters[section.mikanWeekday])")
  }
}

struct SubscriptionBadgeChip: View {
  let badge: SubscriptionBadge

  var body: some View {
    Text(badge.title)
      .font(.caption2.weight(.semibold))
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(Capsule().fill(tint.opacity(0.13)))
      .foregroundStyle(tint)
      .accessibilityIdentifier("subscription-badge-\(identifier)")
  }

  private var tint: Color {
    switch badge {
    case .newEpisodes: .accentColor
    case .syncing: .secondary
    case .failureRetry: .red
    }
  }

  private var identifier: String {
    switch badge {
    case .newEpisodes: "new"
    case .syncing: "syncing"
    case .failureRetry: "failure"
    }
  }
}

struct SubscriptionScheduleRow: View {
  let entry: SubscriptionScheduleEntry
  let showsWeekday: Bool
  let baseURL: URL?
  let onOpen: () -> Void
  let onEditTargets: () -> Void
  let onRetryFailures: () -> Void
  let onUnsubscribe: () -> Void

  private static let dayCharacters = ["日", "一", "二", "三", "四", "五", "六"]

  var body: some View {
    Button(action: onOpen) {
      HStack(spacing: 11) {
        SubscriptionCoverView(urlString: entry.coverURLString, baseURL: baseURL)
        VStack(alignment: .leading, spacing: 4) {
          Text(entry.group.replica.title)
            .font(.body.weight(.semibold))
            .foregroundStyle(.primary)
            .lineLimit(1)
          Text(subtitle)
            .font(.caption)
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        if let badge = entry.badge {
          SubscriptionBadgeChip(badge: badge)
        }
      }
      .padding(.vertical, 4)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button("取消订阅", role: .destructive, action: onUnsubscribe)
    }
    .contextMenu {
      Button("编辑目标", action: onEditTargets)
      if entry.badge == .failureRetry {
        Button("重试失败剧集", action: onRetryFailures)
      }
      Button("取消订阅", role: .destructive, action: onUnsubscribe)
    }
    .accessibilityIdentifier("subscription-row-\(entry.group.accessibilityID)")
  }

  private var subtitle: String {
    var parts = [entry.group.replica.subgroupName, "已收 \(entry.episodeCount) 集"]
    if showsWeekday, let weekday = entry.mikanWeekday {
      parts.append("周\(Self.dayCharacters[weekday])")
    }
    return parts.joined(separator: " · ")
  }
}

private struct SubscriptionCoverView: View {
  let urlString: String?
  let baseURL: URL?

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 6, style: .continuous)
        .fill(.quaternary)
      if let url = resolvedURL {
        AsyncImage(url: url) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .scaledToFill()
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
    .frame(width: 40, height: 54)
    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
  }

  private var resolvedURL: URL? {
    guard let value = urlString, !value.isEmpty else { return nil }
    if let absolute = URL(string: value), absolute.scheme != nil {
      return absolute
    }
    guard let baseURL else { return nil }
    return URL(string: value, relativeTo: baseURL)?.absoluteURL
  }

  private var placeholder: some View {
    Image(systemName: "sparkles.tv")
      .font(.system(size: 15))
      .foregroundStyle(.secondary)
  }
}
