import SwiftUI
import UIKit

final class SettingsViewController: SwiftUIHostingViewController {
  var onAppearanceModeChange: ((AppearanceMode) -> Void)?

  private let model: AppModel
  private let backgroundStatusService: TorrentBackgroundStatusService
  private let contentSourceConnectionTester: any ContentSourceConnectionTesting
  private let mteamCredentialStore: any MTeamCredentialStore
  private let mikanRuntime: MikanRuntimeInstallation

  init(
    model: AppModel,
    mikanRuntime: MikanRuntimeInstallation,
    backgroundStatusService: TorrentBackgroundStatusService,
    mteamCredentialStore: any MTeamCredentialStore = KeychainMTeamCredentialStore(),
    contentSourceConnectionTester: (any ContentSourceConnectionTesting)? = nil
  ) {
    self.model = model
    self.backgroundStatusService = backgroundStatusService
    self.mikanRuntime = mikanRuntime
    self.mteamCredentialStore = mteamCredentialStore
    self.contentSourceConnectionTester =
      contentSourceConnectionTester
      ?? (model.isDemoMode
        ? DemoContentSourceConnectionTester()
        : URLSessionContentSourceConnectionTester())
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "设置")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    host(
      SettingsContentView(
        onAppearanceModeChange: { [weak self] mode in
          self?.onAppearanceModeChange?(mode)
        },
        onOpenAbout: { [weak self] in
          self?.showAbout()
        },
        onOpenBackgroundStatus: { [weak self] in
          self?.showBackgroundStatus()
        },
        onOpenContentSources: { [weak self] in
          self?.showContentSources()
        },
        onOpenDiagnostics: { [weak self] in
          self?.showDiagnostics()
        },
        onOpenServers: { [weak self] in
          self?.showServers()
        },
        onOpenSystemShortcuts: { [weak self] in
          self?.showSystemShortcuts()
        }
      )
      .environment(model)
    )
  }

  func showServers() {
    guard let navigationController else { return }
    if navigationController.topViewController is ServersViewController {
      return
    }
    if navigationController.viewControllers.first !== self {
      navigationController.setViewControllers([self], animated: false)
    } else if navigationController.viewControllers.count > 1 {
      navigationController.popToRootViewController(animated: false)
    }
    navigationController.pushViewController(ServersViewController(model: model), animated: true)
  }

  func showContentSources() {
    guard let navigationController else { return }
    if navigationController.topViewController is ContentSourcesViewController {
      return
    }
    if navigationController.viewControllers.first !== self {
      navigationController.setViewControllers([self], animated: false)
    } else if navigationController.viewControllers.count > 1 {
      navigationController.popToRootViewController(animated: false)
    }
    navigationController.pushViewController(
      ContentSourcesViewController(
        connectionTester: contentSourceConnectionTester,
        mteamCredentialStore: mteamCredentialStore
      ),
      animated: true
    )
  }

  private func showDiagnostics() {
    navigationController?.pushViewController(
      DiagnosticsViewController(
        model: model,
        mikanRuntime: mikanRuntime,
        mteamCredentialStore: mteamCredentialStore
      ),
      animated: true
    )
  }

  private func showBackgroundStatus() {
    navigationController?.pushViewController(
      BackgroundStatusViewController(service: backgroundStatusService),
      animated: true
    )
  }

  private func showAbout() {
    navigationController?.pushViewController(AboutViewController(), animated: true)
  }

  private func showSystemShortcuts() {
    navigationController?.pushViewController(SystemShortcutsViewController(), animated: true)
  }
}

private struct SettingsContentView: View {
  @AppStorage("appearanceMode") private var appearanceMode = AppearanceMode.system.rawValue
  @AppStorage("refreshInterval") private var refreshInterval = 5
  @AppStorage(TorrentFilter.remembersLastSelectionStorageKey)
  private var remembersLastTorrentFilter = true
  @Environment(AppModel.self) private var model

  let onAppearanceModeChange: (AppearanceMode) -> Void
  let onOpenAbout: () -> Void
  let onOpenBackgroundStatus: () -> Void
  let onOpenContentSources: () -> Void
  let onOpenDiagnostics: () -> Void
  let onOpenServers: () -> Void
  let onOpenSystemShortcuts: () -> Void

  var body: some View {
    Form {
      Section("连接") {
        SettingsNavigationButton(
          title: String(localized: "服务器"),
          detail: serverSummary,
          systemImage: "externaldrive.connected.to.line.below",
          action: onOpenServers
        )
        .accessibilityIdentifier("settings-servers")
      }

      Section("发现") {
        SettingsNavigationButton(
          title: String(localized: "内容来源"),
          detail: "Mikan · M-Team",
          systemImage: "safari",
          action: onOpenContentSources
        )
        .accessibilityIdentifier("settings-content-sources")
      }

      Section("应用") {
        Picker("外观", selection: $appearanceMode) {
          ForEach(AppearanceMode.allCases) { mode in
            Text(mode.label).tag(mode.rawValue)
          }
        }
        .onChange(of: appearanceMode) { _, newValue in
          onAppearanceModeChange(AppearanceMode(rawValue: newValue) ?? .system)
        }

        Picker("任务刷新", selection: $refreshInterval) {
          Text("3 秒").tag(3)
          Text("5 秒").tag(5)
          Text("10 秒").tag(10)
          Text("30 秒").tag(30)
        }

        Toggle("记住上次任务筛选", isOn: $remembersLastTorrentFilter)

        SettingsNavigationButton(
          title: String(localized: "后台与通知"),
          detail: String(localized: "下载完成"),
          systemImage: "bell.badge",
          action: onOpenBackgroundStatus
        )
        .accessibilityIdentifier("settings-background-status")

        SettingsNavigationButton(
          title: String(localized: "系统指令"),
          detail: String(localized: "3 个"),
          systemImage: "command",
          action: onOpenSystemShortcuts
        )
        .accessibilityIdentifier("settings-system-shortcuts")
      }

      Section("支持") {
        SettingsNavigationButton(
          title: String(localized: "诊断"),
          detail: diagnosticSummary,
          systemImage: "stethoscope",
          action: onOpenDiagnostics
        )
        .accessibilityIdentifier("settings-diagnostics")

        SettingsNavigationButton(
          title: String(localized: "关于"),
          detail: appVersion,
          systemImage: "info.circle",
          action: onOpenAbout
        )
        .accessibilityIdentifier("settings-about")
      }
    }
  }

  private var serverSummary: String {
    guard let activeServer = model.activeServer else {
      return model.servers.isEmpty
        ? String(localized: "未配置") : String(localized: "\(model.servers.count) 台")
    }
    return String(localized: "\(activeServer.name) · \(model.servers.count) 台")
  }

  private var diagnosticSummary: String {
    model.activeServer == nil ? String(localized: "需要配置") : String(localized: "可检查")
  }

  private var appVersion: String {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    return [version, build.map { "(\($0))" }]
      .compactMap { $0 }
      .joined(separator: " ")
  }
}

private final class SystemShortcutsViewController: SwiftUIHostingViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "系统指令")
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(
      SystemShortcutsContentView(
        onOpenShortcuts: {
          guard let url = URL(string: "shortcuts://") else { return }
          UIApplication.shared.open(url)
        }
      )
    )
  }
}

private struct SystemShortcutsContentView: View {
  let onOpenShortcuts: () -> Void

  var body: some View {
    Form {
      Section {
        ShortcutDescriptionRow(
          title: String(localized: "打开任务"),
          description: String(localized: "直接进入任务 Tab。"),
          systemImage: "arrow.down.circle"
        )
        ShortcutDescriptionRow(
          title: String(localized: "刷新任务"),
          description: String(localized: "打开 App 并刷新当前服务器。"),
          systemImage: "arrow.clockwise"
        )
        ShortcutDescriptionRow(
          title: String(localized: "添加 Magnet"),
          description: String(localized: "接收链接并进入导入确认，不自动提交。"),
          systemImage: "link.badge.plus"
        )
      } header: {
        Text("Torrent Vibe App Intents")
      } footer: {
        Text("可在快捷指令、Siri 与 Spotlight 中使用。")
      }

      Section {
        Button(action: onOpenShortcuts) {
          Label("打开“快捷指令”App", systemImage: "arrow.up.forward.app")
        }
        .accessibilityIdentifier("open-shortcuts-app")
      }
    }
    .accessibilityIdentifier("system-shortcuts-list")
  }
}

private struct ShortcutDescriptionRow: View {
  let title: String
  let description: String
  let systemImage: String

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: systemImage)
        .frame(width: 24)
        .foregroundStyle(Color.accentColor)
      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(.body.weight(.medium))
        Text(description)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
  }
}

private final class BackgroundStatusViewController: SwiftUIHostingViewController {
  private let service: TorrentBackgroundStatusService

  init(service: TorrentBackgroundStatusService) {
    self.service = service
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "后台与通知")
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(BackgroundStatusContentView().environment(service))
    Task { await service.refreshStatus() }
  }
}

private struct BackgroundStatusContentView: View {
  @Environment(TorrentBackgroundStatusService.self) private var service

  var body: some View {
    @Bindable var service = service

    Form {
      Section {
        Toggle(
          "下载完成通知",
          isOn: Binding(
            get: { service.isNotificationsEnabled },
            set: { enabled in
              Task { await service.setNotificationsEnabled(enabled) }
            }
          )
        )
        .accessibilityIdentifier("background-notifications-toggle")

        LabeledContent("通知权限", value: service.authorizationText)
        LabeledContent("后台刷新", value: service.schedulingText)
      } header: {
        Text("系统状态")
      } footer: {
        Text("检查时间由系统决定，只读取状态，不会改动下载。")
      }

      Section {
        Button {
          Task { await service.performCheck() }
        } label: {
          HStack {
            Label("立即检查", systemImage: "arrow.clockwise")
            Spacer()
            if service.isChecking {
              ProgressView()
            }
          }
        }
        .disabled(service.isChecking)
        .accessibilityIdentifier("background-check-now")

        if let lastResult = service.lastResult {
          Label(lastResult, systemImage: "checkmark.circle")
            .foregroundStyle(.secondary)
            .accessibilityIdentifier("background-check-result")
        }
      } header: {
        Text("状态检查")
      } footer: {
        Text("任务完成时通知你。")
      }

      if let errorMessage = service.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
        }
      }
    }
  }
}

private struct SettingsNavigationButton: View {
  let title: String
  let detail: String
  let systemImage: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Label(title, systemImage: systemImage)
          .foregroundStyle(.primary)
        Spacer(minLength: 12)
        Text(detail)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(1)
        Image(systemName: "chevron.right")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.tertiary)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

private final class ContentSourcesViewController: SwiftUIHostingViewController {
  private let connectionTester: any ContentSourceConnectionTesting
  private let mteamCredentialStore: any MTeamCredentialStore

  init(
    connectionTester: any ContentSourceConnectionTesting,
    mteamCredentialStore: any MTeamCredentialStore
  ) {
    self.connectionTester = connectionTester
    self.mteamCredentialStore = mteamCredentialStore
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "内容来源")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      ContentSourcesContentView(
        connectionTester: connectionTester,
        mteamCredentialStore: mteamCredentialStore
      )
    )
  }
}

private struct ContentSourcesContentView: View {
  @State private var apiKeyInput = ""
  @State private var hasStoredAPIKey: Bool
  @State private var mikanBaseURL: String
  @State private var mikanEnabled: Bool
  @State private var mikanSaveError: String?
  @State private var mikanSavedMessage: String?
  @State private var mikanTestID: UUID?
  @State private var mikanTestState = ContentSourceTestState.idle
  @State private var mteamBaseURL: String
  @State private var mteamEnabled: Bool
  @State private var mteamMode: String
  @State private var mteamPageSize: Int
  @State private var mteamSaveError: String?
  @State private var mteamSavedMessage: String?
  @State private var mteamTestID: UUID?
  @State private var mteamTestState = ContentSourceTestState.idle

  private let connectionTester: any ContentSourceConnectionTesting
  private let defaults: UserDefaults
  private let mteamCredentialStore: any MTeamCredentialStore

  init(
    connectionTester: any ContentSourceConnectionTesting,
    mteamCredentialStore: any MTeamCredentialStore,
    defaults: UserDefaults = .standard
  ) {
    self.connectionTester = connectionTester
    self.mteamCredentialStore = mteamCredentialStore
    self.defaults = defaults
    _hasStoredAPIKey = State(
      initialValue: (try? mteamCredentialStore.apiKey())?.isEmpty == false
    )
    _mikanBaseURL = State(
      initialValue: defaults.string(forKey: "discover.mikan.baseURL") ?? "https://mikanani.me"
    )
    _mikanEnabled = State(
      initialValue: defaults.object(forKey: "discover.mikan.enabled") == nil
        ? true : defaults.bool(forKey: "discover.mikan.enabled")
    )
    _mteamBaseURL = State(
      initialValue: defaults.string(forKey: "discover.mteam.baseURL")
        ?? "https://api.m-team.cc/api"
    )
    _mteamEnabled = State(initialValue: defaults.bool(forKey: "discover.mteam.enabled"))
    _mteamMode = State(
      initialValue: defaults.string(forKey: "discover.mteam.mode") ?? "normal"
    )
    let pageSize = defaults.integer(forKey: "discover.mteam.pageSize")
    _mteamPageSize = State(initialValue: pageSize == 0 ? 20 : pageSize)
  }

  var body: some View {
    Form {
      Section {
        Toggle("启用 Mikan", isOn: mikanEnabledBinding)
        TextField("Base URL", text: mikanBaseURLBinding)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
          .accessibilityIdentifier("mikan-settings-base-url")

        Button(action: testMikanConnection) {
          ContentSourceTestButtonLabel(
            provider: "Mikan",
            state: mikanTestState
          )
        }
        .disabled(mikanTestState.isTesting)
        .accessibilityIdentifier("mikan-settings-test")

        Button("保存 Mikan 配置", action: saveMikanConfiguration)
          .accessibilityIdentifier("mikan-settings-save")

        ContentSourceTestFeedback(
          state: mikanTestState,
          accessibilityIdentifier: "mikan-settings-test-result"
        )

        if let mikanSaveError {
          ProviderConfigurationFeedback(
            message: mikanSaveError,
            isError: true
          )
        } else if let mikanSavedMessage {
          ProviderConfigurationFeedback(
            message: mikanSavedMessage,
            isError: false
          )
        }
      } header: {
        Text("Mikan")
      } footer: {
        Text("测试不会保存配置。")
      }

      Section {
        Toggle("启用 M-Team", isOn: mteamEnabledBinding)
        TextField("Base URL", text: mteamBaseURLBinding)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
          .accessibilityIdentifier("mteam-settings-base-url")
        Picker("模式", selection: mteamModeBinding) {
          ForEach(MTeamDisplay.modes, id: \.value) { option in
            Text(option.label).tag(option.value)
          }
        }
        Picker("每页数量", selection: mteamPageSizeBinding) {
          ForEach([10, 20, 25, 50, 100], id: \.self) { value in
            Text("\(value) 条").tag(value)
          }
        }
        SecureField(
          hasStoredAPIKey ? String(localized: "API Key 已存储；留空表示保持") : String(localized: "API Key"),
          text: apiKeyInputBinding
        )
        .textContentType(.password)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .accessibilityIdentifier("mteam-settings-api-key")

        Button(action: testMTeamConnection) {
          ContentSourceTestButtonLabel(
            provider: "M-Team",
            state: mteamTestState
          )
        }
        .disabled(mteamTestState.isTesting)
        .accessibilityIdentifier("mteam-settings-test")

        Button("保存 M-Team 配置", action: saveMTeamConfiguration)
          .accessibilityIdentifier("mteam-settings-save")

        if hasStoredAPIKey {
          Button("移除 API Key", role: .destructive, action: deleteMTeamAPIKey)
        }

        ContentSourceTestFeedback(
          state: mteamTestState,
          accessibilityIdentifier: "mteam-settings-test-result"
        )

        if let mteamSaveError {
          ProviderConfigurationFeedback(
            message: mteamSaveError,
            isError: true
          )
        } else if let mteamSavedMessage {
          ProviderConfigurationFeedback(
            message: mteamSavedMessage,
            isError: false
          )
        }
      } header: {
        Text("M-Team")
      } footer: {
        Text("API Key 保存后只存放在本机 Keychain。")
      }
    }
  }

  private func testMikanConnection() {
    let testID = UUID()
    mikanSaveError = nil
    mikanSavedMessage = nil
    mikanTestID = testID
    mikanTestState = .testing
    Task {
      do {
        let result = try await connectionTester.testMikan(baseURL: try mikanURL())
        guard !Task.isCancelled, mikanTestID == testID else { return }
        mikanTestState = .success(result.message)
      } catch {
        guard !Task.isCancelled, mikanTestID == testID else { return }
        mikanTestState = .failure(error.localizedDescription)
      }
    }
  }

  private func testMTeamConnection() {
    let testID = UUID()
    mteamSaveError = nil
    mteamSavedMessage = nil
    mteamTestID = testID
    mteamTestState = .testing
    Task {
      do {
        let result = try await connectionTester.testMTeam(
          configuration: try mteamConfiguration(),
          mode: mteamMode
        )
        guard !Task.isCancelled, mteamTestID == testID else { return }
        mteamTestState = .success(result.message)
      } catch {
        guard !Task.isCancelled, mteamTestID == testID else { return }
        mteamTestState = .failure(error.localizedDescription)
      }
    }
  }

  private func saveMikanConfiguration() {
    mikanSaveError = nil
    mikanSavedMessage = nil
    do {
      let url = try mikanURL()
      defaults.set(mikanEnabled, forKey: "discover.mikan.enabled")
      defaults.set(url.absoluteString, forKey: "discover.mikan.baseURL")
      mikanSavedMessage =
        mikanEnabled ? String(localized: "Mikan 已启用") : String(localized: "Mikan 配置已保存")
    } catch {
      mikanSaveError = error.localizedDescription
    }
  }

  private func saveMTeamConfiguration() {
    mteamSaveError = nil
    mteamSavedMessage = nil
    do {
      let existingAPIKey = try mteamCredentialStore.apiKey() ?? ""
      let normalizedInput = apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines)
      let effectiveAPIKey = normalizedInput.isEmpty ? existingAPIKey : normalizedInput
      _ = try MTeamProviderConfiguration(
        baseURLText: mteamBaseURL,
        apiKey: mteamEnabled
          ? effectiveAPIKey : (effectiveAPIKey.isEmpty ? "disabled" : effectiveAPIKey),
        pageSize: mteamPageSize
      )
      if !normalizedInput.isEmpty {
        try mteamCredentialStore.setAPIKey(normalizedInput)
        hasStoredAPIKey = true
        apiKeyInput = ""
      }
      defaults.set(mteamEnabled, forKey: "discover.mteam.enabled")
      defaults.set(
        mteamBaseURL.trimmingCharacters(in: .whitespacesAndNewlines),
        forKey: "discover.mteam.baseURL")
      defaults.set(mteamMode, forKey: "discover.mteam.mode")
      defaults.set(mteamPageSize, forKey: "discover.mteam.pageSize")
      mteamSavedMessage =
        mteamEnabled ? String(localized: "M-Team 已启用") : String(localized: "M-Team 配置已保存")
    } catch {
      mteamSaveError = error.localizedDescription
    }
  }

  private func deleteMTeamAPIKey() {
    mteamSaveError = nil
    mteamSavedMessage = nil
    mteamTestState = .idle
    do {
      try mteamCredentialStore.deleteAPIKey()
      hasStoredAPIKey = false
      mteamEnabled = false
      defaults.set(false, forKey: "discover.mteam.enabled")
      mteamSavedMessage = String(localized: "API Key 已从 Keychain 移除，M-Team 已停用")
    } catch {
      mteamSaveError = error.localizedDescription
    }
  }

  private func mikanURL() throws -> URL {
    let normalizedBaseURL = mikanBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      let url = URL(string: normalizedBaseURL),
      ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
      url.host != nil
    else {
      throw ContentSourceConnectionError.invalidMikanBaseURL
    }
    return url
  }

  private func mteamConfiguration() throws -> MTeamProviderConfiguration {
    let existingAPIKey = try mteamCredentialStore.apiKey() ?? ""
    let normalizedInput = apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines)
    return try MTeamProviderConfiguration(
      baseURLText: mteamBaseURL,
      apiKey: normalizedInput.isEmpty ? existingAPIKey : normalizedInput,
      pageSize: mteamPageSize
    )
  }

  private func clearMikanFeedback() {
    mikanSaveError = nil
    mikanSavedMessage = nil
    mikanTestID = nil
    mikanTestState = .idle
  }

  private func clearMTeamFeedback() {
    mteamSaveError = nil
    mteamSavedMessage = nil
    mteamTestID = nil
    mteamTestState = .idle
  }

  private var mikanBaseURLBinding: Binding<String> {
    Binding(
      get: { mikanBaseURL },
      set: { newValue in
        mikanBaseURL = newValue
        clearMikanFeedback()
      }
    )
  }

  private var mikanEnabledBinding: Binding<Bool> {
    Binding(
      get: { mikanEnabled },
      set: { newValue in
        mikanEnabled = newValue
        clearMikanFeedback()
      }
    )
  }

  private var mteamBaseURLBinding: Binding<String> {
    Binding(
      get: { mteamBaseURL },
      set: { newValue in
        mteamBaseURL = newValue
        clearMTeamFeedback()
      }
    )
  }

  private var mteamEnabledBinding: Binding<Bool> {
    Binding(
      get: { mteamEnabled },
      set: { newValue in
        mteamEnabled = newValue
        clearMTeamFeedback()
      }
    )
  }

  private var mteamModeBinding: Binding<String> {
    Binding(
      get: { mteamMode },
      set: { newValue in
        mteamMode = newValue
        clearMTeamFeedback()
      }
    )
  }

  private var mteamPageSizeBinding: Binding<Int> {
    Binding(
      get: { mteamPageSize },
      set: { newValue in
        mteamPageSize = newValue
        clearMTeamFeedback()
      }
    )
  }

  private var apiKeyInputBinding: Binding<String> {
    Binding(
      get: { apiKeyInput },
      set: { newValue in
        apiKeyInput = newValue
        clearMTeamFeedback()
      }
    )
  }
}

private enum ContentSourceTestState: Equatable {
  case failure(String)
  case idle
  case success(String)
  case testing

  var isTesting: Bool {
    self == .testing
  }
}

private struct ContentSourceTestButtonLabel: View {
  let provider: String
  let state: ContentSourceTestState

  var body: some View {
    HStack(spacing: 8) {
      if state.isTesting {
        ProgressView()
          .controlSize(.small)
      }
      Text(
        state.isTesting
          ? String(localized: "正在测试 \(provider)…")
          : String(localized: "测试 \(provider) 连接")
      )
    }
  }
}

private struct ContentSourceTestFeedback: View {
  let state: ContentSourceTestState
  let accessibilityIdentifier: String

  var body: some View {
    switch state {
    case .idle, .testing:
      EmptyView()
    case .success(let message):
      Label(message, systemImage: "checkmark.circle.fill")
        .font(.footnote)
        .foregroundStyle(.green)
        .accessibilityIdentifier(accessibilityIdentifier)
    case .failure(let message):
      Label(message, systemImage: "exclamationmark.triangle.fill")
        .font(.footnote)
        .foregroundStyle(.red)
        .accessibilityIdentifier(accessibilityIdentifier)
    }
  }
}

private struct ProviderConfigurationFeedback: View {
  let message: String
  let isError: Bool

  var body: some View {
    Label(
      message,
      systemImage: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"
    )
    .font(.footnote)
    .foregroundStyle(isError ? Color.red : Color.green)
  }
}

private final class DiagnosticsViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let mteamCredentialStore: any MTeamCredentialStore
  private let mikanRuntime: MikanRuntimeInstallation

  init(
    model: AppModel,
    mikanRuntime: MikanRuntimeInstallation,
    mteamCredentialStore: any MTeamCredentialStore
  ) {
    self.model = model
    self.mikanRuntime = mikanRuntime
    self.mteamCredentialStore = mteamCredentialStore
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "诊断")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      DiagnosticsContentView(
        model: model,
        mteamStatus: mteamStatus,
        mikanRuntime: mikanRuntime,
        onCopyReport: { [weak self] in
          self?.copyReport()
        }
      )
    )
  }

  private func copyReport() {
    let report = """
      Torrent Vibe \(appVersion)
      iOS \(UIDevice.current.systemVersion)
      Servers: \(model.servers.count)
      Active server: \(model.activeServer == nil ? "no" : "yes")
      qBittorrent: \(model.activeServer.map { model.connectionStatusText(for: $0.id) } ?? "not configured")
      Helper configured: \(model.activeServer?.helperBaseURL == nil ? "no" : "yes")
      Mikan parser: \(mikanRuntime.statusText)
      M-Team: \(mteamStatus)
      """
    UIPasteboard.general.string = report

    let alert = UIAlertController(
      title: String(localized: "诊断报告已复制"),
      message: String(localized: "报告不包含凭据或完整地址。"),
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: String(localized: "好"), style: .default))
    present(alert, animated: true)
  }

  private var appVersion: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
  }

  private var mteamStatus: String {
    guard UserDefaults.standard.bool(forKey: "discover.mteam.enabled") else {
      return String(localized: "未启用")
    }
    do {
      return try mteamCredentialStore.apiKey()?.isEmpty == false
        ? String(localized: "已配置") : String(localized: "缺少 API Key")
    } catch {
      return String(localized: "Keychain 不可读")
    }
  }
}

private struct DiagnosticsContentView: View {
  let model: AppModel
  let mteamStatus: String
  let mikanRuntime: MikanRuntimeInstallation
  let onCopyReport: () -> Void

  var body: some View {
    Form {
      Section("连接") {
        LabeledContent(
          "qBittorrent",
          value: model.activeServer.map { model.connectionStatusText(for: $0.id) }
            ?? String(localized: "未配置")
        )
        LabeledContent(
          "Helper",
          value: model.activeServer?.helperBaseURL == nil
            ? String(localized: "未配置") : String(localized: "已配置")
        )
      }

      Section("内容") {
        LabeledContent("Mikan", value: mikanRuntime.statusText)
        LabeledContent("M-Team", value: mteamStatus)
      }

      Section {
        Button("复制脱敏诊断报告", action: onCopyReport)
          .accessibilityIdentifier("diagnostics-copy-report")
      }
    }
  }
}

private final class AboutViewController: SwiftUIHostingViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "关于")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(AboutContentView())
  }
}

private struct AboutContentView: View {
  var body: some View {
    Form {
      Section {
        LabeledContent("应用", value: "Torrent Vibe")
        LabeledContent("版本", value: appVersion)
        LabeledContent("最低系统", value: "iOS 26")
      }

      Section("架构") {
        LabeledContent("导航与呈现", value: "UIKit")
        LabeledContent("页面内容", value: "SwiftUI")
        LabeledContent("Mikan 解析", value: "JavaScriptCore")
      }
    }
  }

  private var appVersion: String {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    return [version, build.map { "(\($0))" }]
      .compactMap { $0 }
      .joined(separator: " ")
  }
}
