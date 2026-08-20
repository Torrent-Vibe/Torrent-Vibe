import SwiftUI

struct MikanSubscriptionRow: View {
  @Environment(MikanSubscriptionsScreenState.self) private var state

  let group: HelperSubscriptionGroup
  let onEditTargets: (HelperSubscriptionGroup) -> Void
  let onOpenSubscription: (HelperSubscriptionGroup) -> Void
  let onRetry: (UUID, HelperReplica, HelperEpisodeStatus) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 12) {
        Button {
          onOpenSubscription(group)
        } label: {
          VStack(alignment: .leading, spacing: 5) {
            Text(group.replica.title)
              .font(.headline)
            Label(group.replica.subgroupName, systemImage: "person.2")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("helper-subscription-open-\(group.accessibilityID)")

        Button {
          onEditTargets(group)
        } label: {
          Image(systemName: "ellipsis.circle")
            .font(.body)
            .frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("编辑目标服务器")
        .accessibilityIdentifier("helper-subscription-edit-target-\(group.accessibilityID)")
      }

      Label(group.targets.map(\.serverName).joined(separator: "、"), systemImage: "server.rack")
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .accessibilityIdentifier("helper-subscription-targets-\(group.accessibilityID)")

      ForEach(group.targets) { target in
        targetStatusRow(group: group, target: target)
      }
    }
    .padding(.vertical, 4)
  }

  private func targetStatusRow(
    group: HelperSubscriptionGroup,
    target: HelperSubscriptionTarget
  ) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(target.serverName)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      if let episode = target.episodes.first {
        HStack(alignment: .firstTextBaseline) {
          Text(episode.title)
            .font(.caption)
            .lineLimit(2)
          Spacer()
          Text(episode.state.title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(episode.state.isRetryable ? .red : .secondary)
        }
        if let lastError = episode.lastError {
          Text(lastError)
            .font(.caption2)
            .foregroundStyle(.red)
        }
        if episode.state.isRetryable {
          retryButton(
            serverID: target.serverID,
            replica: group.replica,
            episode: episode
          )
        }
      } else {
        Label("等待 Helper 拉取更新", systemImage: "clock")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }

  private func retryButton(
    serverID: UUID,
    replica: HelperReplica,
    episode: HelperEpisodeStatus
  ) -> some View {
    let retryID = SubscriptionsViewController.retryID(
      serverID: serverID,
      episodeID: episode.episodeId
    )
    return Button {
      onRetry(serverID, replica, episode)
    } label: {
      if state.retryingEpisodeIDs.contains(retryID) {
        ProgressView()
      } else {
        Label("重试", systemImage: "arrow.clockwise")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.regular)
    .disabled(state.retryingEpisodeIDs.contains(retryID))
    .accessibilityIdentifier("helper-episode-retry-\(serverID.uuidString)-\(episode.episodeId)")
  }
}
