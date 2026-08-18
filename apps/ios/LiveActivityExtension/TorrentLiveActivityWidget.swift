import ActivityKit
import SwiftUI
import WidgetKit

struct TorrentLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TorrentLiveActivityAttributes.self) { context in
      TorrentLiveActivityLockScreenView(context: context)
        .activityBackgroundTint(Color(.secondarySystemBackground))
        .activitySystemActionForegroundColor(.primary)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(context.attributes.torrentName)
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)

            HStack(spacing: 4) {
              Image(systemName: "externaldrive.fill")
              Text(context.attributes.serverName)
                .lineLimit(1)
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(context.attributes.serverName)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            HStack {
              Spacer(minLength: 0)
              Text(context.state.progress, format: .percent.precision(.fractionLength(0)))
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(activityColor(for: context.state))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }

            ProgressView(value: context.state.progress)
              .tint(activityColor(for: context.state))

            HStack(spacing: 8) {
              Label(context.state.downloadSpeed, systemImage: "arrow.down")
                .lineLimit(1)
                .minimumScaleFactor(0.8)

              Spacer(minLength: 12)

              HStack(spacing: 6) {
                Label(context.state.eta, systemImage: "clock")
                  .lineLimit(1)
                  .minimumScaleFactor(0.8)
                Text(context.state.status)
                  .fontWeight(.semibold)
                  .lineLimit(1)
              }
              .layoutPriority(1)
            }
            .padding(.horizontal, 6)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
          }
        }
      } compactLeading: {
        Image(systemName: activitySymbol(for: context.state))
          .foregroundStyle(activityColor(for: context.state))
          .accessibilityLabel(context.state.status)
      } compactTrailing: {
        Text(context.state.progress, format: .percent.precision(.fractionLength(0)))
          .font(.caption2.monospacedDigit().weight(.semibold))
          .foregroundStyle(activityColor(for: context.state))
          .accessibilityLabel("进度")
      } minimal: {
        Text(context.state.progress, format: .percent.precision(.fractionLength(0)))
          .font(.caption2.monospacedDigit().weight(.bold))
          .foregroundStyle(activityColor(for: context.state))
          .accessibilityLabel("\(context.state.status)，进度")
      }
      .keylineTint(.blue)
      .widgetURL(URL(string: "torrentvibe://tasks"))
    }
  }

  private func activityColor(
    for state: TorrentLiveActivityAttributes.ContentState
  ) -> Color {
    state.isComplete ? .green : .blue
  }

  private func activitySymbol(
    for state: TorrentLiveActivityAttributes.ContentState
  ) -> String {
    state.isComplete ? "checkmark.circle.fill" : "arrow.down.circle.fill"
  }
}

private struct TorrentLiveActivityLockScreenView: View {
  let context: ActivityViewContext<TorrentLiveActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        Image(systemName: activitySymbol)
          .font(.title2)
          .foregroundStyle(activityColor)

        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.torrentName)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
          Text(context.attributes.serverName)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        Spacer(minLength: 8)

        Text(context.state.progress, format: .percent.precision(.fractionLength(0)))
          .font(.title3.monospacedDigit().weight(.semibold))
          .foregroundStyle(activityColor)
      }

      ProgressView(value: context.state.progress)
        .tint(activityColor)

      HStack(spacing: 14) {
        Label(context.state.downloadSpeed, systemImage: "arrow.down")
        Label(context.state.eta, systemImage: "clock")
        Spacer(minLength: 0)
        Text(context.state.status)
          .fontWeight(.semibold)
      }
      .font(.caption.monospacedDigit())
      .foregroundStyle(.secondary)
    }
    .padding(16)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "\(context.attributes.torrentName)，\(context.state.status)，进度 \(percentageText)"
    )
  }

  private var activityColor: Color {
    context.state.isComplete ? .green : .blue
  }

  private var activitySymbol: String {
    context.state.isComplete ? "checkmark.circle.fill" : "arrow.down.circle.fill"
  }

  private var percentageText: String {
    context.state.progress.formatted(.percent.precision(.fractionLength(0)))
  }
}
