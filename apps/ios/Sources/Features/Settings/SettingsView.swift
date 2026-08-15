import SwiftUI
import UIKit

final class SettingsViewController: SwiftUIHostingViewController {
  var onAppearanceModeChange: ((AppearanceMode) -> Void)?

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "设置"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    host(
      SettingsContentView { [weak self] mode in
        self?.onAppearanceModeChange?(mode)
      }
    )
  }
}

private struct SettingsContentView: View {
  @AppStorage("appearanceMode") private var appearanceMode = AppearanceMode.system.rawValue
  @AppStorage("refreshInterval") private var refreshInterval = 5

  let onAppearanceModeChange: (AppearanceMode) -> Void

  var body: some View {
    Form {
      Section("外观") {
        Picker("显示模式", selection: $appearanceMode) {
          ForEach(AppearanceMode.allCases) { mode in
            Text(mode.label).tag(mode.rawValue)
          }
        }
        .onChange(of: appearanceMode) { _, newValue in
          onAppearanceModeChange(AppearanceMode(rawValue: newValue) ?? .system)
        }
      }

      Section("任务") {
        Picker("刷新间隔", selection: $refreshInterval) {
          Text("3 秒").tag(3)
          Text("5 秒").tag(5)
          Text("10 秒").tag(10)
          Text("30 秒").tag(30)
        }
      }

      Section("安全与连接") {
        LabeledContent("凭据存储", value: "Keychain（待接入）")
        LabeledContent("qBittorrent API", value: "服务边界已建立")
        LabeledContent("Helper API", value: "服务边界已建立")
      }

      Section("关于") {
        LabeledContent("应用", value: "Torrent Vibe")
        LabeledContent("版本", value: appVersion)
        LabeledContent("应用壳层", value: "UIKit")
        LabeledContent("内容嵌入", value: "SwiftUI")
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
