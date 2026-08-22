import SwiftUI

struct TorrentRow: View {
  let torrent: TorrentSummary
  let isSelecting: Bool
  let isSelected: Bool

  var body: some View {
    HStack(spacing: 12) {
      if isSelecting {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
          .font(.title3)
          .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
          .accessibilityHidden(true)
      }

      VStack(alignment: .leading, spacing: 7) {
        HStack(alignment: .top, spacing: 8) {
          Image(systemName: statusSymbol)
            .foregroundStyle(statusColor)
            .frame(width: 20)
          Text(torrent.name)
            .font(.body.weight(.medium))
            .lineLimit(2)
        }

        HStack(spacing: 8) {
          ProgressView(value: torrent.progress)
            .tint(statusColor)
          Text(torrent.progress, format: .percent.precision(.fractionLength(0)))
            .font(.caption.monospacedDigit().weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(minWidth: 36, alignment: .trailing)
        }

        HStack(spacing: 10) {
          Text(torrent.size)
            .foregroundStyle(.secondary)
          Spacer(minLength: 8)
          if torrent.status == .downloading {
            Text(torrent.downloadSpeed)
              .font(.caption.weight(.semibold))
              .foregroundStyle(.blue)
            Text(torrent.eta)
              .font(.caption.weight(.semibold))
              .foregroundStyle(.secondary)
          } else if torrent.status == .seeding {
            Text(torrent.uploadSpeed)
              .font(.caption.weight(.semibold))
              .foregroundStyle(.green)
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
    .accessibilityValue(isSelecting ? (isSelected ? "已选择" : "未选择") : "")
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
