import Observation
import SwiftUI
import UIKit

final class ServerEditorViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let serverID: UUID?
  private let form = ServerFormState()

  init(model: AppModel, serverID: UUID? = nil) {
    self.model = model
    self.serverID = serverID
    super.init(nibName: nil, bundle: nil)

    if let serverID, let server = model.servers.first(where: { $0.id == serverID }) {
      form.name = server.name
      form.baseURL = server.baseURL.absoluteString
      form.username = server.username
      form.helperURL = server.helperBaseURL?.absoluteString ?? ""
      form.isEditing = true
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = form.isEditing ? "编辑服务器" : "添加服务器"
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
    host(ServerFormView(form: form))
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  @objc private func save() {
    do {
      if let serverID {
        try model.updateServer(
          id: serverID,
          name: form.name,
          baseURLText: form.baseURL,
          username: form.username,
          password: form.password,
          helperURLText: form.helperURL
        )
      } else {
        try model.addServer(
          name: form.name,
          baseURLText: form.baseURL,
          username: form.username,
          password: form.password,
          helperURLText: form.helperURL
        )
      }
      dismiss(animated: true)
    } catch {
      let alert = UIAlertController(
        title: form.isEditing ? "无法更新服务器" : "无法保存服务器",
        message: error.localizedDescription,
        preferredStyle: .alert
      )
      alert.addAction(UIAlertAction(title: "好", style: .cancel))
      present(alert, animated: true)
    }
  }
}

@MainActor
@Observable
private final class ServerFormState {
  var name = ""
  var baseURL = "http://"
  var username = ""
  var password = ""
  var helperURL = ""
  var isEditing = false
}

private struct ServerFormView: View {
  @Bindable var form: ServerFormState

  var body: some View {
    Form {
      Section("服务器") {
        TextField("名称，例如：家庭 NAS", text: $form.name)
          .textContentType(.organizationName)
          .accessibilityIdentifier("server-add-name")
        TextField("qBittorrent WebUI 地址", text: $form.baseURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
          .accessibilityIdentifier("server-add-base-url")
        TextField("用户名", text: $form.username)
          .textContentType(.username)
          .textInputAutocapitalization(.never)
          .accessibilityIdentifier("server-add-username")
        SecureField(
          form.isEditing ? "留空则保持原密码" : "密码",
          text: $form.password
        )
        .textContentType(form.isEditing ? .newPassword : .password)
        .accessibilityIdentifier("server-add-password")
      }

      Section {
        TextField("例如：http://nas.local:17890", text: $form.helperURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
          .accessibilityIdentifier("server-add-helper-url")
      } header: {
        Text("可选 Helper")
      } footer: {
        Text(
          form.isEditing
            ? "更改 Helper 地址会解除当前配对，需要重新输入配对码。"
            : "Helper 使用 spec 中定义的普通 JSON API。此处只登记端点，不执行自动绑定。"
        )
      }

      Section {
        Label(
          form.isEditing
            ? "密码留空则继续使用本机 Keychain 中已保存的凭据。"
            : "密码仅写入本机 Keychain，不进入服务器配置或日志。",
          systemImage: "key"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    }
  }
}
