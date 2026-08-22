import SwiftUI

struct TorrentOverviewCard: View {
  let serverName: String
  let downloadSpeed: String
  let uploadSpeed: String

  var body: some View {
    VStack(spacing: 6) {
      Text(serverName)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)

      HStack(spacing: 0) {
        TorrentOverviewMetric(
          title: "下载", value: downloadSpeed, systemImage: "arrow.down", color: .blue)
        Divider().frame(height: 28)
        TorrentOverviewMetric(
          title: "上传", value: uploadSpeed, systemImage: "arrow.up", color: .green)
      }
    }
    .padding(.top, 8)
    .padding(.bottom, 9)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
    .padding(.vertical, 2)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("torrent-overview")
  }
}

private struct TorrentOverviewMetric: View {
  let title: String
  let value: String
  let systemImage: String
  let color: Color

  var body: some View {
    VStack(spacing: 3) {
      Label(title, systemImage: systemImage)
        .font(.caption.weight(.medium))
        .foregroundStyle(color)
      Text(value)
        .font(.subheadline.weight(.semibold))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity)
  }
}
