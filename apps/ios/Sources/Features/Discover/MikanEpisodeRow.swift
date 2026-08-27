import SwiftUI

extension MikanEpisodeBadgeTone {
  fileprivate var color: Color {
    switch self {
    case .success: .green
    case .accent: .blue
    case .neutral: .secondary
    case .destructive: .red
    case .warning: .orange
    case .muted: .secondary
    }
  }
}

struct MikanEpisodeRow: View {
  let episode: MikanEpisode
  let canImport: Bool
  let rowModel: MikanEpisodeRowModel
  let isRetrying: Bool
  let onRetry: () -> Void
  let onDownloadAnyway: () -> Void

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text(episode.title)
          .font(.body)
          .foregroundStyle(.primary)
          .multilineTextAlignment(.leading)
        HStack(spacing: 8) {
          if let sizeBytes = episode.sizeBytes {
            Text(ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file))
              .monospacedDigit()
          }
          if let publishedAt = episode.publishedAt {
            Text(publishedAt)
          }
          if let badge = rowModel.badge {
            Label(badge.title, systemImage: badge.icon)
              .foregroundStyle(badge.tone.color)
          }
          if let liveProgressText = rowModel.liveProgressText {
            Text(liveProgressText)
              .monospacedDigit()
          }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      trailing
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityHint(rowModel.remedy == .importEpisode && canImport ? String(localized: "导入到当前服务器") : "")
    .accessibilityIdentifier("mikan-episode-\(episode.episodeId)")
  }

  @ViewBuilder
  private var trailing: some View {
    switch rowModel.remedy {
    case .importEpisode:
      if canImport {
        Image(systemName: "plus.circle")
          .font(.title3)
          .foregroundStyle(.tint)
          .accessibilityHidden(true)
      }
    case .retry:
      Button(action: onRetry) {
        if isRetrying {
          ProgressView()
        } else {
          Label("重试", systemImage: "arrow.clockwise")
        }
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
      .disabled(isRetrying)
      .accessibilityIdentifier("mikan-episode-retry-\(episode.episodeId)")
    case .downloadAnyway:
      Button("仍要下载", action: onDownloadAnyway)
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(!canImport)
        .accessibilityIdentifier("mikan-episode-download-anyway-\(episode.episodeId)")
    case nil:
      EmptyView()
    }
  }
}
