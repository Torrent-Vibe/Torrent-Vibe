import SwiftUI
import UIKit

final class DiscoverViewController: SwiftUIHostingViewController {
  private let model: AppModel

  init(model: AppModel) {
    self.model = model
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "发现"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    host(DiscoverContentView().environment(model))
  }
}

private struct DiscoverContentView: View {
  @Environment(AppModel.self) private var model
  @State private var selection = DiscoverSection.season

  var body: some View {
    List {
      Section {
        Picker("发现内容", selection: $selection) {
          ForEach(DiscoverSection.allCases) { section in
            Text(section.label).tag(section)
          }
        }
        .pickerStyle(.segmented)
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())
      }

      Section {
        ContentUnavailableView {
          Label(selection.emptyTitle, systemImage: selection.systemImage)
        } description: {
          Text(selection.emptyDescription)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
      }

      Section("已建立的边界") {
        IntegrationRow(
          title: "Mikan 内容服务",
          detail: "当季、搜索与订阅视图",
          systemImage: "sparkles.tv"
        )
        IntegrationRow(
          title: "Helper JSON API",
          detail: model.activeServer?.helperBaseURL == nil ? "等待服务器绑定" : "端点已配置，等待配对",
          systemImage: "shippingbox"
        )
        IntegrationRow(
          title: "qBittorrent 导入",
          detail: "复用统一任务服务层",
          systemImage: "arrow.down.app"
        )
      }
    }
  }
}

private enum DiscoverSection: String, CaseIterable, Identifiable {
  case season
  case subscriptions

  var id: Self { self }

  var label: String {
    switch self {
    case .season: "当季"
    case .subscriptions: "我的订阅"
    }
  }

  var emptyTitle: String {
    switch self {
    case .season: "Mikan 发现入口已就绪"
    case .subscriptions: "尚无订阅"
    }
  }

  var emptyDescription: String {
    switch self {
    case .season: "下一阶段将通过独立内容服务加载当季番组。"
    case .subscriptions: "Helper 配对后，订阅会在目标下载主机持续执行。"
    }
  }

  var systemImage: String {
    switch self {
    case .season: "safari"
    case .subscriptions: "bookmark"
    }
  }
}

private struct IntegrationRow: View {
  let title: String
  let detail: String
  let systemImage: String

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 3) {
        Text(title)
        Text(detail)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    } icon: {
      Image(systemName: systemImage)
        .foregroundStyle(.blue)
    }
  }
}
