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
      ServersContentView(
        onAddServer: { [weak self] in
          self?.presentAddServer()
        },
        onOpenServer: { [weak self] serverID in
          self?.showServer(serverID)
        }
      )
      .environment(model)
    )
  }

  private func showServer(_ serverID: UUID) {
    navigationController?.pushViewController(
      ServerDetailViewController(model: model, serverID: serverID),
      animated: true
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
  let onOpenServer: (UUID) -> Void

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
                onOpenServer(server.id)
              } label: {
                ServerRow(
                  server: server,
                  isActive: server.id == model.activeServerID,
                  connectionStatus: model.connectionStatusText(for: server.id),
                  helperStatus: model.helperStatusText(for: server.id)
                )
              }
              .buttonStyle(.plain)
              .accessibilityIdentifier("server-row-\(server.id.uuidString)")
            }
          }

          Section {
            Text("密码仅保存在本机 Keychain；服务器配置不会包含明文凭据。")
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
  let connectionStatus: String
  let helperStatus: String

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

        HStack(spacing: 10) {
          Label(connectionStatus, systemImage: "network")
          Label(helperStatus, systemImage: modelHelperImage)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      }

      Spacer()

      if isActive {
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.blue)
      }
      Image(systemName: "chevron.right")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.tertiary)
    }
    .contentShape(Rectangle())
    .padding(.vertical, 4)
  }

  private var modelHelperImage: String {
    helperStatus.hasPrefix("已连接") || helperStatus == "已配对" ? "link" : "shippingbox"
  }
}

private final class ServerDetailViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let serverID: UUID

  init(model: AppModel, serverID: UUID) {
    self.model = model
    self.serverID = serverID
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = model.servers.first(where: { $0.id == serverID })?.name ?? "服务器"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      ServerDetailContentView(
        serverID: serverID,
        onOpenHelper: { [weak self] in
          self?.showHelper()
        },
        onDelete: { [weak self] in
          self?.confirmDelete()
        }
      )
      .environment(model)
    )
  }

  private func showHelper() {
    navigationController?.pushViewController(
      HelperConnectionViewController(model: model, serverID: serverID),
      animated: true
    )
  }

  private func confirmDelete() {
    guard let server = model.servers.first(where: { $0.id == serverID }) else { return }
    let isCurrent = server.id == model.activeServerID
    let message =
      isCurrent
      ? "这是当前服务器。删除后将切换到其他服务器；如无其他服务器，App 将进入无服务器状态。"
      : "服务器凭据和本地配置将一并移除；远端 Torrent 不受影响。"
    let alert = UIAlertController(
      title: "删除“\(server.name)”？",
      message: message,
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(
      UIAlertAction(title: "删除", style: .destructive) { [weak self] _ in
        guard let self else { return }
        model.removeServer(id: serverID)
        navigationController?.popViewController(animated: true)
      })
    present(alert, animated: true)
  }
}

private struct ServerDetailContentView: View {
  @Environment(AppModel.self) private var model

  let serverID: UUID
  let onOpenHelper: () -> Void
  let onDelete: () -> Void

  var body: some View {
    Group {
      if let server = model.servers.first(where: { $0.id == serverID }) {
        Form {
          Section("状态") {
            LabeledContent(
              "当前服务器",
              value: server.id == model.activeServerID ? "是" : "否"
            )
            LabeledContent(
              "连接",
              value: model.isDemoMode
                ? "演示环境"
                : model.connectionStatusText(for: server.id)
            )
            if !model.isDemoMode {
              Button(model.isRefreshing ? "正在测试连接" : "测试连接") {
                Task { await model.testConnection(for: server) }
              }
              .disabled(model.isRefreshing)
              .accessibilityIdentifier("server-test-connection")
            }
            if server.id != model.activeServerID {
              Button("设为当前服务器") {
                model.selectServer(server)
              }
              .accessibilityIdentifier("server-set-active")
            }
          }

          Section("qBittorrent") {
            LabeledContent("地址", value: server.baseURL.absoluteString)
            LabeledContent("用户名", value: server.username.isEmpty ? "未设置" : server.username)
            LabeledContent(
              "密码",
              value: model.hasStoredPassword(for: server.id) ? "已存入 Keychain" : "未保存"
            )
          }

          Section("Helper") {
            Button(action: onOpenHelper) {
              HStack(spacing: 12) {
                Label("Helper", systemImage: "shippingbox")
                  .foregroundStyle(.primary)
                Spacer(minLength: 12)
                Text(model.helperStatusText(for: server.id))
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
            .accessibilityIdentifier("server-helper-open")
          }

          Section {
            Button("删除服务器", role: .destructive, action: onDelete)
              .accessibilityIdentifier("server-delete")
          }
        }
      } else {
        ContentUnavailableView("服务器不存在", systemImage: "externaldrive.badge.xmark")
      }
    }
  }
}

@MainActor
@Observable
private final class AddServerFormState {
  var name = ""
  var baseURL = "http://"
  var username = ""
  var password = ""
  var helperURL = ""
}

private struct AddServerFormView: View {
  @Bindable var form: AddServerFormState

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
        SecureField("密码", text: $form.password)
          .textContentType(.password)
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
        Text("Helper 使用 spec 中定义的普通 JSON API。此处只登记端点，不执行自动绑定。")
      }

      Section {
        Label("密码仅写入本机 Keychain，不进入服务器配置或日志。", systemImage: "key")
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
        password: form.password,
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
