import Observation
import SwiftUI
import UIKit

final class ServersViewController: SwiftUIHostingViewController {
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
    title = "服务器"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .add,
      target: self,
      action: #selector(presentAddServer)
    )
    navigationItem.rightBarButtonItem?.accessibilityLabel = "添加服务器"
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "server-toolbar-add"

    host(
      ServersContentView { [weak self] in
        self?.presentAddServer()
      }
      .environment(model)
    )
  }

  @objc private func presentAddServer() {
    let addServer = AddServerViewController(model: model)
    let navigationController = UINavigationController(rootViewController: addServer)
    navigationController.modalPresentationStyle = .formSheet
    present(navigationController, animated: true)
  }
}

private struct ServersContentView: View {
  @Environment(AppModel.self) private var model

  let onAddServer: () -> Void

  var body: some View {
    Group {
      if model.servers.isEmpty {
        ContentUnavailableView {
          Label("尚无服务器", systemImage: "externaldrive.badge.plus")
        } description: {
          Text("添加 qBittorrent 地址，建立移动端连接配置。")
        } actions: {
          Button("添加服务器", action: onAddServer)
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("server-empty-add")
        }
      } else {
        List {
          Section("qBittorrent") {
            ForEach(model.servers) { server in
              Button {
                model.selectServer(server)
              } label: {
                ServerRow(
                  server: server,
                  isActive: server.id == model.activeServerID,
                  isDemo: model.isDemoMode
                )
              }
              .buttonStyle(.plain)
              .accessibilityIdentifier("server-row-\(server.id.uuidString)")
            }
            .onDelete(perform: model.removeServers)
          }

          Section {
            Text("当前阶段仅持久化名称、地址与用户名。密码和会话令牌必须在 Keychain 服务接入后保存。")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }
}

private struct ServerRow: View {
  let server: ServerConfiguration
  let isActive: Bool
  let isDemo: Bool

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "externaldrive.fill")
        .font(.title3)
        .foregroundStyle(isActive ? .blue : .secondary)
        .frame(width: 28)

      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 6) {
          Text(server.name)
            .font(.body.weight(.medium))
            .foregroundStyle(.primary)
          if isActive {
            Text("当前")
              .font(.caption2.weight(.semibold))
              .foregroundStyle(.blue)
          }
        }

        Text(server.baseURL.absoluteString)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)

        Label(helperStatus, systemImage: server.helperBaseURL == nil ? "shippingbox" : "link")
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      Spacer()

      if isActive {
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.blue)
      }
    }
    .contentShape(Rectangle())
    .padding(.vertical, 4)
  }

  private var helperStatus: String {
    if isDemo { return "Helper 演示端点" }
    return server.helperBaseURL == nil ? "未配置 Helper" : "等待 Helper 配对"
  }
}

@MainActor
@Observable
private final class AddServerFormState {
  var name = ""
  var baseURL = "http://"
  var username = ""
  var helperURL = ""
}

private struct AddServerFormView: View {
  @Bindable var form: AddServerFormState

  var body: some View {
    Form {
      Section("服务器") {
        TextField("名称，例如：家庭 NAS", text: $form.name)
          .textContentType(.organizationName)
        TextField("qBittorrent WebUI 地址", text: $form.baseURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
        TextField("用户名", text: $form.username)
          .textContentType(.username)
          .textInputAutocapitalization(.never)
      }

      Section {
        TextField("例如：http://nas.local:17890", text: $form.helperURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
      } header: {
        Text("可选 Helper")
      } footer: {
        Text("Helper 使用 spec 中定义的普通 JSON API。此处只登记端点，不执行自动绑定。")
      }

      Section {
        Label("凭据输入与 Keychain 保存将在连接服务接入后实现。", systemImage: "key")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }
}

private final class AddServerViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let form = AddServerFormState()

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
    title = "添加服务器"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancel)
    )
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .save,
      target: self,
      action: #selector(save)
    )
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "server-add-save"
    host(AddServerFormView(form: form))
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  @objc private func save() {
    do {
      try model.addServer(
        name: form.name,
        baseURLText: form.baseURL,
        username: form.username,
        helperURLText: form.helperURL
      )
      dismiss(animated: true)
    } catch {
      let alert = UIAlertController(
        title: "无法保存服务器",
        message: error.localizedDescription,
        preferredStyle: .alert
      )
      alert.addAction(UIAlertAction(title: "好", style: .cancel))
      present(alert, animated: true)
    }
  }
}
