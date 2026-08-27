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
    title = String(localized: "服务器")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .always
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .add,
      target: self,
      action: #selector(presentAddServer)
    )
    navigationItem.rightBarButtonItem?.accessibilityLabel = String(localized: "添加服务器")
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "server-toolbar-add"

    host(
      ServersContentView(
        onAddServer: { [weak self] in
          self?.presentEditor()
        },
        onOpenServer: { [weak self] serverID in
          self?.showServer(serverID)
        },
        onEditServer: { [weak self] serverID in
          self?.presentEditor(serverID: serverID)
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
    presentEditor()
  }

  func presentEditor(serverID: UUID? = nil) {
    let editor = ServerEditorViewController(model: model, serverID: serverID)
    let navigationController = UINavigationController(rootViewController: editor)
    navigationController.modalPresentationStyle = .formSheet
    present(navigationController, animated: true)
  }
}

private struct ServersContentView: View {
  @Environment(AppModel.self) private var model

  let onAddServer: () -> Void
  let onOpenServer: (UUID) -> Void
  let onEditServer: (UUID) -> Void

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
                  isActive: server.id == model.activeServerID
                )
              }
              .buttonStyle(.plain)
              .accessibilityIdentifier("server-row-\(server.id.uuidString)")
              .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button("编辑") {
                  onEditServer(server.id)
                }
                .tint(.blue)
                .accessibilityIdentifier("server-swipe-edit-\(server.id.uuidString)")
              }
            }
          }

          Section {
            Text("密码只保存在本机 Keychain。")
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

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "externaldrive.fill")
        .font(.body)
        .foregroundStyle(isActive ? .blue : .secondary)
        .frame(width: 28, alignment: .center)
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(server.name)
          .font(.body)
          .foregroundStyle(.primary)
        Text(server.baseURL.absoluteString)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if isActive {
        Image(systemName: "checkmark")
          .font(.body.weight(.semibold))
          .foregroundStyle(.blue)
          .accessibilityHidden(true)
      }
      Image(systemName: "chevron.right")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.tertiary)
        .accessibilityHidden(true)
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityValue(isActive ? String(localized: "当前服务器") : "")
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
    title = model.servers.first(where: { $0.id == serverID })?.name ?? String(localized: "服务器")
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: String(localized: "编辑"),
      style: .plain,
      target: self,
      action: #selector(presentEditor)
    )
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "server-edit"
    host(
      ServerDetailContentView(
        serverID: serverID,
        onOpenHelper: { [weak self] in
          self?.showHelper()
        },
        onEdit: { [weak self] in
          self?.presentEditor()
        },
        onDelete: { [weak self] in
          self?.confirmDelete()
        }
      )
      .environment(model)
    )
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    title = model.servers.first(where: { $0.id == serverID })?.name ?? String(localized: "服务器")
  }

  @objc private func presentEditor() {
    let editor = ServerEditorViewController(model: model, serverID: serverID)
    let navigationController = UINavigationController(rootViewController: editor)
    navigationController.modalPresentationStyle = .formSheet
    present(navigationController, animated: true)
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
      ? String(localized: "这是当前服务器。删除后将切换到其他服务器；如无其他服务器，App 将进入无服务器状态。")
      : String(localized: "服务器凭据和本地配置将一并移除；远端 Torrent 不受影响。")
    let alert = UIAlertController(
      title: String(localized: "删除“\(server.name)”？"),
      message: message,
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: String(localized: "取消"), style: .cancel))
    alert.addAction(
      UIAlertAction(title: String(localized: "删除"), style: .destructive) { [weak self] _ in
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
  let onEdit: () -> Void
  let onDelete: () -> Void

  var body: some View {
    Group {
      if let server = model.servers.first(where: { $0.id == serverID }) {
        Form {
          Section("状态") {
            LabeledContent(
              "当前服务器",
              value: server.id == model.activeServerID
                ? String(localized: "是") : String(localized: "否")
            )
            LabeledContent(
              "连接",
              value: model.isDemoMode
                ? String(localized: "演示环境")
                : model.connectionStatusText(for: server.id)
            )
            if !model.isDemoMode {
              Button(model.isRefreshing ? String(localized: "正在测试连接") : String(localized: "测试连接")) {
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
            LabeledContent(
              "用户名",
              value: server.username.isEmpty ? String(localized: "未设置") : server.username
            )
            LabeledContent(
              "密码",
              value: model.hasStoredPassword(for: server.id)
                ? String(localized: "已存入 Keychain") : String(localized: "未保存")
            )
            Button("编辑连接信息", action: onEdit)
              .accessibilityIdentifier("server-edit-connection")
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
