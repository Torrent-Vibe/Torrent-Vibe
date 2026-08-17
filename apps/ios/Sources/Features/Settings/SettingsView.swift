import SwiftUI
import UIKit

final class SettingsViewController: SwiftUIHostingViewController {
  var onAppearanceModeChange: ((AppearanceMode) -> Void)?

  private let model: AppModel
  private let mikanRuntime: MikanRuntimeInstallation

  init(model: AppModel, mikanRuntime: MikanRuntimeInstallation) {
    self.model = model
    self.mikanRuntime = mikanRuntime
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "设置"
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
        onOpenContentSources: { [weak self] in
          self?.showContentSources()
        },
        onOpenDiagnostics: { [weak self] in
          self?.showDiagnostics()
        },
        onOpenServers: { [weak self] in
          self?.showServers()
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

  private func showContentSources() {
    navigationController?.pushViewController(ContentSourcesViewController(), animated: true)
  }

  private func showDiagnostics() {
    navigationController?.pushViewController(
      DiagnosticsViewController(model: model, mikanRuntime: mikanRuntime),
      animated: true
    )
  }

  private func showAbout() {
    navigationController?.pushViewController(AboutViewController(), animated: true)
  }
}

private struct SettingsContentView: View {
  @AppStorage("appearanceMode") private var appearanceMode = AppearanceMode.system.rawValue
  @AppStorage("refreshInterval") private var refreshInterval = 5
  @Environment(AppModel.self) private var model

  let onAppearanceModeChange: (AppearanceMode) -> Void
  let onOpenAbout: () -> Void
  let onOpenContentSources: () -> Void
  let onOpenDiagnostics: () -> Void
  let onOpenServers: () -> Void

  var body: some View {
    Form {
      Section("连接") {
        SettingsNavigationButton(
          title: "服务器",
          detail: serverSummary,
          systemImage: "externaldrive.connected.to.line.below",
          action: onOpenServers
        )
        .accessibilityIdentifier("settings-servers")
      }

      Section("发现") {
        SettingsNavigationButton(
          title: "内容来源",
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
      }

      Section("支持") {
        SettingsNavigationButton(
          title: "诊断",
          detail: diagnosticSummary,
          systemImage: "stethoscope",
          action: onOpenDiagnostics
        )
        .accessibilityIdentifier("settings-diagnostics")

        SettingsNavigationButton(
          title: "关于",
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
      return model.servers.isEmpty ? "未配置" : "\(model.servers.count) 台"
    }
    return "\(activeServer.name) · \(model.servers.count) 台"
  }

  private var diagnosticSummary: String {
    model.activeServer == nil ? "需要配置" : "可检查"
  }

  private var appVersion: String {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    return [version, build.map { "(\($0))" }]
      .compactMap { $0 }
      .joined(separator: " ")
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
  override func viewDidLoad() {
    super.viewDidLoad()
    title = "内容来源"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(ContentSourcesContentView())
  }
}

private struct ContentSourcesContentView: View {
  @AppStorage("discover.mikan.baseURL") private var mikanBaseURL = "https://mikanani.me"
  @AppStorage("discover.mikan.enabled") private var mikanEnabled = true
  @AppStorage("discover.mteam.enabled") private var mteamEnabled = false

  var body: some View {
    Form {
      Section {
        Toggle("启用 Mikan", isOn: $mikanEnabled)
        TextField("Base URL", text: $mikanBaseURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
      } header: {
        Text("Mikan")
      } footer: {
        Text("页面解析器固定随 App 发布；这里只配置内容站点地址。")
      }

      Section {
        Toggle("启用 M-Team", isOn: $mteamEnabled)
          .disabled(true)
        LabeledContent("状态", value: "等待 Keychain 凭据接入")
      } header: {
        Text("M-Team")
      } footer: {
        Text("API Key 接入前不会启用该 Provider，也不会写入 UserDefaults。")
      }
    }
  }
}

private final class DiagnosticsViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let mikanRuntime: MikanRuntimeInstallation

  init(model: AppModel, mikanRuntime: MikanRuntimeInstallation) {
    self.model = model
    self.mikanRuntime = mikanRuntime
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "诊断"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      DiagnosticsContentView(
        model: model,
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
      """
    UIPasteboard.general.string = report

    let alert = UIAlertController(
      title: "诊断报告已复制",
      message: "报告不包含凭据或完整地址。",
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "好", style: .default))
    present(alert, animated: true)
  }

  private var appVersion: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
  }
}

private struct DiagnosticsContentView: View {
  let model: AppModel
  let mikanRuntime: MikanRuntimeInstallation
  let onCopyReport: () -> Void

  var body: some View {
    Form {
      Section("连接") {
        LabeledContent(
          "qBittorrent",
          value: model.activeServer.map { model.connectionStatusText(for: $0.id) } ?? "未配置"
        )
        LabeledContent("Helper", value: model.activeServer?.helperBaseURL == nil ? "未配置" : "端点已登记")
      }

      Section("内容") {
        LabeledContent("Mikan", value: mikanRuntime.statusText)
        LabeledContent("M-Team", value: "未配置")
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
    title = "关于"
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
