@preconcurrency import ActivityKit
import Foundation
import Observation

extension TorrentLiveActivityAttributes.ContentState {
  init(torrent: TorrentSummary, updatedAt: Date = .now) {
    let isComplete = torrent.status == .completed || torrent.progress >= 1
    self.init(
      downloadSpeed: torrent.downloadSpeed,
      eta: isComplete ? "已完成" : torrent.eta,
      isComplete: isComplete,
      progress: min(max(torrent.progress, 0), 1),
      status: isComplete ? "已完成" : torrent.statusTitle,
      updatedAt: updatedAt
    )
  }
}

@MainActor
@Observable
final class TorrentLiveActivityCoordinator {
  static let shared = TorrentLiveActivityCoordinator()

  private(set) var activeTorrentID: String?
  private(set) var activeTorrentName: String?
  private(set) var errorMessage: String?
  private(set) var isPerformingAction = false
  private(set) var statusMessage = "可在锁屏与灵动岛显示此任务"

  private let authorizationInfo: ActivityAuthorizationInfo

  init(authorizationInfo: ActivityAuthorizationInfo = ActivityAuthorizationInfo()) {
    self.authorizationInfo = authorizationInfo
    restoreExistingActivityStatus()
  }

  var areActivitiesEnabled: Bool {
    authorizationInfo.areActivitiesEnabled
  }

  func start(torrent: TorrentSummary, server: ServerConfiguration) async {
    guard !isPerformingAction else { return }
    errorMessage = nil

    guard areActivitiesEnabled else {
      statusMessage = "系统已关闭实时活动"
      errorMessage = "请在系统设置中允许 Torrent Vibe 使用实时活动。"
      return
    }

    guard torrent.status != .completed, torrent.progress < 1 else {
      statusMessage = "已完成的任务无需持续跟踪"
      return
    }

    isPerformingAction = true
    defer { isPerformingAction = false }

    let state = TorrentLiveActivityAttributes.ContentState(torrent: torrent)
    let content = activityContent(state: state)

    if let current = activity(forTorrentID: torrent.id, serverID: server.id) {
      await current.update(content)
      setActiveStatus(from: current.attributes)
      return
    }

    await endAllActivities(dismissalPolicy: .immediate)

    do {
      let attributes = TorrentLiveActivityAttributes(
        serverID: server.id.uuidString,
        serverName: server.name,
        torrentID: torrent.id,
        torrentName: torrent.name
      )
      let activity = try Activity<TorrentLiveActivityAttributes>.request(
        attributes: attributes,
        content: content,
        pushType: nil
      )
      setActiveStatus(from: activity.attributes)
    } catch {
      activeTorrentID = nil
      activeTorrentName = nil
      statusMessage = "实时活动启动失败"
      errorMessage = error.localizedDescription
    }
  }

  func stop() async {
    guard !isPerformingAction else { return }
    isPerformingAction = true
    errorMessage = nil
    await endAllActivities(dismissalPolicy: .immediate)
    activeTorrentID = nil
    activeTorrentName = nil
    statusMessage = "实时活动已停止"
    isPerformingAction = false
  }

  func synchronize(torrents: [TorrentSummary], server: ServerConfiguration) async {
    let activities = Activity<TorrentLiveActivityAttributes>.activities
    guard
      let activity = activities.first(where: {
        $0.attributes.serverID == server.id.uuidString
      })
    else {
      restoreExistingActivityStatus(from: activities)
      return
    }

    guard let torrent = torrents.first(where: { $0.id == activity.attributes.torrentID }) else {
      let finalState = activity.content.state
      await activity.end(
        ActivityContent(state: finalState, staleDate: nil),
        dismissalPolicy: .immediate
      )
      restoreExistingActivityStatus()
      return
    }

    let state = TorrentLiveActivityAttributes.ContentState(torrent: torrent)
    if state.isComplete {
      await activity.end(
        ActivityContent(state: state, staleDate: nil, relevanceScore: 1),
        dismissalPolicy: .after(.now.addingTimeInterval(60))
      )
      activeTorrentID = nil
      activeTorrentName = nil
      statusMessage = "任务已完成，实时活动即将结束"
    } else {
      await activity.update(activityContent(state: state))
      setActiveStatus(from: activity.attributes)
    }
  }

  func refreshStatus() {
    restoreExistingActivityStatus()
  }

  func statusText(for torrent: TorrentSummary) -> String {
    if activeTorrentID == torrent.id {
      return "正在锁屏与灵动岛跟踪"
    }
    if let activeTorrentName {
      return "当前正在跟踪“\(activeTorrentName)”"
    }
    return statusMessage
  }

  private func activity(
    forTorrentID torrentID: String,
    serverID: UUID
  ) -> Activity<TorrentLiveActivityAttributes>? {
    Activity<TorrentLiveActivityAttributes>.activities.first {
      $0.attributes.torrentID == torrentID
        && $0.attributes.serverID == serverID.uuidString
    }
  }

  private func activityContent(
    state: TorrentLiveActivityAttributes.ContentState
  ) -> ActivityContent<TorrentLiveActivityAttributes.ContentState> {
    ActivityContent(
      state: state,
      staleDate: state.updatedAt.addingTimeInterval(90),
      relevanceScore: state.progress
    )
  }

  private func endAllActivities(dismissalPolicy: ActivityUIDismissalPolicy) async {
    for activity in Activity<TorrentLiveActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: dismissalPolicy)
    }
  }

  private func restoreExistingActivityStatus(
    from activities: [Activity<TorrentLiveActivityAttributes>] = Activity<
      TorrentLiveActivityAttributes
    >.activities
  ) {
    guard let activity = activities.first else {
      activeTorrentID = nil
      activeTorrentName = nil
      statusMessage =
        areActivitiesEnabled
        ? "可在锁屏与灵动岛显示此任务"
        : "系统已关闭实时活动"
      return
    }
    setActiveStatus(from: activity.attributes)
  }

  private func setActiveStatus(from attributes: TorrentLiveActivityAttributes) {
    activeTorrentID = attributes.torrentID
    activeTorrentName = attributes.torrentName
    statusMessage = "正在锁屏与灵动岛跟踪"
  }
}
