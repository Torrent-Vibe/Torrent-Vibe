import SwiftUI

struct TorrentRow: View {
  let torrent: TorrentSummary
  let isSelecting: Bool
  let isSelected: Bool

  var body: some View {
    HStack(spacing: 10) {
      if isSelecting {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
          .font(.body)
          .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
          .accessibilityHidden(true)
      }

      Image(systemName: statusSymbol)
        .font(.body)
        .foregroundStyle(statusColor)
        .frame(width: 18)
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 5) {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(torrent.name)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)

          Spacer(minLength: 4)

          Text(torrent.progress, format: .percent.precision(.fractionLength(0)))
            .font(.caption.monospacedDigit().weight(.semibold))
            .foregroundStyle(.secondary)
        }

        ProgressView(value: torrent.progress)
          .tint(statusColor)

        HStack(spacing: 6) {
          Text(torrent.size)
            .foregroundStyle(.tertiary)

          if torrent.status == .downloading {
            Text(torrent.downloadSpeed)
              .foregroundStyle(.blue)
          } else if torrent.status == .seeding {
            Text(torrent.uploadSpeed)
              .foregroundStyle(.green)
          }

          Spacer(minLength: 6)

          if torrent.status == .downloading {
            Text(torrent.eta)
              .foregroundStyle(.secondary)
          }
        }
        .font(.caption.weight(.medium))
        .monospacedDigit()
        .lineLimit(1)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      isSelecting ? (isSelected ? String(localized: "已选择") : String(localized: "未选择")) : "")
  }

  private var statusColor: Color {
    switch torrent.status {
    case .downloading: .blue
    case .seeding, .completed: .green
    case .paused, .queued: .secondary
    case .error: .red
    }
  }

  private var statusSymbol: String {
    switch torrent.status {
    case .downloading: "arrow.down.circle.fill"
    case .seeding: "arrow.up.circle.fill"
    case .completed: "checkmark.circle.fill"
    case .paused: "pause.circle.fill"
    case .queued: "clock.fill"
    case .error: "exclamationmark.circle.fill"
    }
  }
}
