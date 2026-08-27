@preconcurrency import ActivityKit
import BackgroundTasks
import Foundation
import Observation
import UserNotifications

struct TorrentCompletion: Equatable, Sendable {
  let id: String
  let name: String
}

struct TorrentCompletionDetection: Equatable, Sendable {
  let baselineEstablished: Bool
  let newlyCompleted: [TorrentCompletion]
  let storedIDs: Set<String>
}

enum TorrentCompletionDetector {
  static func detect(
    torrents: [TorrentSummary],
    previouslyCompletedIDs: Set<String>?
  ) -> TorrentCompletionDetection {
    let completed = torrents.filter {
      $0.status == .completed || $0.status == .seeding || $0.progress >= 1
    }
    let currentIDs = Set(completed.map(\.id))
    guard let previouslyCompletedIDs else {
      return TorrentCompletionDetection(
        baselineEstablished: true,
        newlyCompleted: [],
        storedIDs: currentIDs
      )
    }
    return TorrentCompletionDetection(
      baselineEstablished: false,
      newlyCompleted: completed.compactMap { torrent in
        guard !previouslyCompletedIDs.contains(torrent.id) else { return nil }
        return TorrentCompletion(id: torrent.id, name: torrent.name)
      },
      storedIDs: previouslyCompletedIDs.union(currentIDs)
    )
  }
}

struct BackgroundStatusCheckResult: Equatable, Sendable {
  let completions: [TorrentCompletion]
  let message: String
}

@MainActor
@Observable
final class TorrentBackgroundStatusService {
  static let taskIdentifier = "dev.innei.torrent-vibe.refresh"

  var authorizationText = String(localized: "正在读取")
  var errorMessage: String?
  var isChecking = false
  var isNotificationsEnabled: Bool
  var lastResult: String?
  var schedulingText = String(localized: "尚未安排")

  private let defaults: UserDefaults
  private let launchArguments: [String]
  private let model: AppModel
  private let notificationCenter: UNUserNotificationCenter
  private var demoCompletionDelivered = false

  private static let enabledKey = "background.notifications.enabled"
  private static let completedIDsKeyPrefix = "background.completedIDs."

  private static var hasActiveLiveActivity: Bool {
    Activity<TorrentLiveActivityAttributes>.activities.contains {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  init(
    model: AppModel,
    defaults: UserDefaults = .standard,
    launchArguments: [String] = ProcessInfo.processInfo.arguments,
    notificationCenter: UNUserNotificationCenter = .current()
  ) {
    self.model = model
    self.defaults = defaults
    self.launchArguments = launchArguments
    self.notificationCenter = notificationCenter
    isNotificationsEnabled = defaults.bool(forKey: Self.enabledKey)
  }

  func refreshStatus() async {
    let settings = await notificationCenter.notificationSettings()
    authorizationText = Self.authorizationText(for: settings.authorizationStatus)
    if settings.authorizationStatus == .denied {
      isNotificationsEnabled = false
      defaults.set(false, forKey: Self.enabledKey)
    }
    if Self.shouldScheduleRefresh(
      notificationsEnabled: isNotificationsEnabled,
      hasActiveLiveActivity: Self.hasActiveLiveActivity
    ) {
      scheduleNextRefresh()
    }
  }

  func setNotificationsEnabled(_ enabled: Bool) async {
    errorMessage = nil
    if enabled {
      do {
        let granted = try await notificationCenter.requestAuthorization(options: [.alert, .sound])
        guard granted else {
          isNotificationsEnabled = false
          defaults.set(false, forKey: Self.enabledKey)
          await refreshStatus()
          return
        }
        isNotificationsEnabled = true
        defaults.set(true, forKey: Self.enabledKey)
        scheduleNextRefresh()
      } catch {
        isNotificationsEnabled = false
        defaults.set(false, forKey: Self.enabledKey)
        errorMessage = error.localizedDescription
      }
    } else {
      isNotificationsEnabled = false
      defaults.set(false, forKey: Self.enabledKey)
      if Self.hasActiveLiveActivity {
        scheduleNextRefresh()
      } else {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
        schedulingText = String(localized: "已关闭")
      }
    }
    await refreshStatus()
  }

  @discardableResult
  func performCheck() async -> BackgroundStatusCheckResult {
    isChecking = true
    errorMessage = nil
    defer { isChecking = false }

    guard let server = model.activeServer else {
      let result = BackgroundStatusCheckResult(
        completions: [],
        message: String(localized: "尚未配置可检查的服务器。")
      )
      lastResult = result.message
      return result
    }

    await model.refreshTorrents()
    if let integrationNotice = model.integrationNotice {
      let result = BackgroundStatusCheckResult(
        completions: [],
        message: "检查失败：\(integrationNotice)"
      )
      errorMessage = result.message
      lastResult = result.message
      scheduleNextRefresh()
      return result
    }

    let detection: TorrentCompletionDetection
    if model.isDemoMode, launchArguments.contains("-ui-background-demo"), !demoCompletionDelivered {
      demoCompletionDelivered = true
      detection = TorrentCompletionDetection(
        baselineEstablished: false,
        newlyCompleted: [
          TorrentCompletion(
            id: "background-demo-completion",
            name: "The Blue Planet II S01"
          )
        ],
        storedIDs: ["background-demo-completion"]
      )
    } else {
      let key = Self.completedIDsKeyPrefix + server.id.uuidString
      let storedIDs = (defaults.array(forKey: key) as? [String]).map(Set.init)
      detection = TorrentCompletionDetector.detect(
        torrents: model.torrents,
        previouslyCompletedIDs: storedIDs
      )
      defaults.set(Array(detection.storedIDs).sorted(), forKey: key)
    }

    if isNotificationsEnabled, !detection.newlyCompleted.isEmpty {
      await postNotifications(detection.newlyCompleted, serverName: server.name)
    }

    let message: String
    if detection.baselineEstablished {
      message = String(localized: "已开始监控，之后有任务完成会通知你。")
    } else if detection.newlyCompleted.isEmpty {
      message = String(localized: "检查完成，没有新的下载完成任务。")
    } else {
      message = String(localized: "检查完成，发现 \(detection.newlyCompleted.count) 个新完成任务。")
    }
    let result = BackgroundStatusCheckResult(
      completions: detection.newlyCompleted,
      message: message
    )
    lastResult = message
    scheduleNextRefresh()
    return result
  }

  func scheduleNextRefresh() {
    guard
      Self.shouldScheduleRefresh(
        notificationsEnabled: isNotificationsEnabled,
        hasActiveLiveActivity: Self.hasActiveLiveActivity
      )
    else {
      schedulingText = String(localized: "通知关闭时不安排")
      return
    }
    #if targetEnvironment(simulator)
      schedulingText = String(localized: "Simulator · 使用立即检查")
      return
    #else
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
      let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
      request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
      do {
        try BGTaskScheduler.shared.submit(request)
        schedulingText = String(localized: "已请求系统后台刷新")
      } catch {
        schedulingText = String(localized: "系统暂未接受后台刷新")
        errorMessage = error.localizedDescription
      }
    #endif
  }

  static func shouldScheduleRefresh(
    notificationsEnabled: Bool,
    hasActiveLiveActivity: Bool
  ) -> Bool {
    notificationsEnabled || hasActiveLiveActivity
  }

  static func scheduleRefreshForLiveActivity() {
    guard hasActiveLiveActivity else { return }
    #if !targetEnvironment(simulator)
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskIdentifier)
      let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
      request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
      try? BGTaskScheduler.shared.submit(request)
    #endif
  }

  static func registerBackgroundTask() {
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: taskIdentifier,
      using: nil
    ) { task in
      guard let refreshTask = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      let operation = Task { @MainActor in
        let model = AppModel()
        let service = TorrentBackgroundStatusService(model: model)
        let result = await service.performCheck()
        refreshTask.setTaskCompleted(success: !result.message.hasPrefix("检查失败"))
      }
      refreshTask.expirationHandler = {
        operation.cancel()
      }
    }
  }

  private func postNotifications(
    _ completions: [TorrentCompletion],
    serverName: String
  ) async {
    for completion in completions {
      let content = UNMutableNotificationContent()
      content.title = String(localized: "下载完成")
      content.body = "\(completion.name) · \(serverName)"
      content.sound = .default
      let request = UNNotificationRequest(
        identifier: "torrent-completed-\(completion.id)",
        content: content,
        trigger: nil
      )
      do {
        try await notificationCenter.add(request)
      } catch {
        errorMessage = error.localizedDescription
      }
    }
  }

  private static func authorizationText(
    for status: UNAuthorizationStatus
  ) -> String {
    switch status {
    case .notDetermined:
      String(localized: "尚未请求")
    case .denied:
      String(localized: "系统已拒绝")
    case .authorized:
      String(localized: "系统已允许")
    case .provisional:
      String(localized: "临时允许")
    case .ephemeral:
      String(localized: "本次允许")
    @unknown default:
      String(localized: "未知")
    }
  }
}
