import SwiftUI
import UIKit

final class HelperConnectionViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let serverID: UUID
  private let discovery: HelperDiscoveryModel

  init(model: AppModel, serverID: UUID) {
    self.model = model
    self.serverID = serverID
    discovery = HelperDiscoveryModel(demoMode: model.isDemoMode)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "Helper"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    host(
      HelperConnectionContentView(
        serverID: serverID,
        discovery: discovery,
        onConfirmUnpair: { [weak self] in
          self?.confirmUnpair()
        },
        onOpenProfileSync: { [weak self] in
          self?.showProfileSync()
        },
        onOpenLogs: { [weak self] in
          self?.showLogs()
        }
      )
      .environment(model)
    )
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    discovery.start()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    discovery.stop()
  }

  private func confirmUnpair() {
    let alert = UIAlertController(
      title: String(localized: "解除 Helper 配对？"),
      message: String(localized: "只会撤销当前 iPhone 的授权；其他客户端和远端订阅不会被删除。"),
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: String(localized: "取消"), style: .cancel))
    alert.addAction(
      UIAlertAction(title: String(localized: "解除配对"), style: .destructive) { [weak self] _ in
        guard let self else { return }
        Task { await model.unpairHelper(for: serverID) }
      })
    present(alert, animated: true)
  }

  private func showProfileSync() {
    navigationController?.pushViewController(
      HelperProfileSyncViewController(model: model, serverID: serverID),
      animated: true
    )
  }

  private func showLogs() {
    navigationController?.pushViewController(
      HelperLogViewController(model: model, serverID: serverID),
      animated: true
    )
  }
}

private struct HelperConnectionContentView: View {
  @Environment(AppModel.self) private var model
  @State private var helperURL = ""
  @State private var pairingCode = ""

  let serverID: UUID
  let discovery: HelperDiscoveryModel
  let onConfirmUnpair: () -> Void
  let onOpenProfileSync: () -> Void
  let onOpenLogs: () -> Void

  var body: some View {
    Group {
      switch model.helperConnectionState(for: serverID) {
      case .connected(let status):
        connectedForm(status)
      case .connecting where model.hasStoredHelperToken(for: serverID):
        loadingForm
      case .failed(let message) where model.hasStoredHelperToken(for: serverID):
        pairedFailureForm(message)
      case .failed(let message):
        pairingForm(errorMessage: message)
      case .connecting, .idle:
        pairingForm(errorMessage: nil)
      }
    }
    .task {
      if helperURL.isEmpty {
        helperURL = server?.helperBaseURL?.absoluteString ?? "http://"
      }
      await model.refreshHelperStatus(for: serverID)
    }
  }

  private func connectedForm(_ status: HelperStatus) -> some View {
    Form {
      Section("状态") {
        LabeledContent("连接", value: String(localized: "已连接"))
          .accessibilityIdentifier("helper-connected-status")
        LabeledContent("版本", value: status.version)
          .accessibilityIdentifier("helper-version")
        LabeledContent("已配对客户端", value: "\(status.clientCount)")
        LabeledContent("活动订阅", value: "\(status.subscriptionCount)")
          .accessibilityIdentifier("helper-subscriptions")
        LabeledContent("待处理项目", value: "\(status.pendingItems)")
      }

      Section("连接信息") {
        LabeledContent("地址", value: server?.helperBaseURL?.absoluteString ?? "—")
        LabeledContent("凭据", value: String(localized: "本机 Keychain"))
      }

      Section {
        Button(action: onOpenProfileSync) {
          HStack {
            Label("凭证同步", systemImage: "arrow.triangle.2.circlepath")
            Spacer()
            Image(systemName: "chevron.right")
              .font(.caption.weight(.semibold))
              .foregroundStyle(.tertiary)
          }
        }
        .accessibilityIdentifier("helper-profile-sync")
      } footer: {
        Text("上传本机凭证，或从下载机拉取；不会自动覆盖。")
      }

      Section {
        Button(action: onOpenLogs) {
          HStack {
            Label("日志", systemImage: "doc.text.magnifyingglass")
            Spacer()
            Image(systemName: "chevron.right")
              .font(.caption.weight(.semibold))
              .foregroundStyle(.tertiary)
          }
        }
        .accessibilityIdentifier("helper-logs")
      } footer: {
        Text("订阅没有按预期下载时，来这里查原因。")
      }

      Section {
        Button("刷新状态") {
          Task { await model.refreshHelperStatus(for: serverID) }
        }
        .accessibilityIdentifier("helper-refresh")

        Button("解除当前设备配对", role: .destructive, action: onConfirmUnpair)
          .accessibilityIdentifier("helper-unpair")
      } footer: {
        Text("只解除这台 iPhone，订阅和下载不受影响。")
      }
    }
  }

  private var loadingForm: some View {
    Form {
      Section {
        HStack(spacing: 12) {
          ProgressView()
          Text("正在读取 Helper 状态")
        }
      }
    }
  }

  private func pairedFailureForm(_ message: String) -> some View {
    Form {
      Section("连接失败") {
        Label(message, systemImage: "exclamationmark.triangle")
          .foregroundStyle(.orange)
        Button("重新连接") {
          Task { await model.refreshHelperStatus(for: serverID) }
        }
        .accessibilityIdentifier("helper-retry")
      }

      Section {
        Button("解除当前设备配对", role: .destructive, action: onConfirmUnpair)
          .accessibilityIdentifier("helper-unpair")
      } footer: {
        Text("随时可以重新配对。")
      }
    }
  }

  private func pairingForm(errorMessage: String?) -> some View {
    Form {
      Section {
        if discovery.helpers.isEmpty {
          HStack(spacing: 12) {
            if discovery.isSearching {
              ProgressView()
            }
            Text(
              discovery.isSearching
                ? String(localized: "正在搜索局域网 Helper")
                : String(localized: "尚未开始搜索")
            )
              .foregroundStyle(.secondary)
          }
        } else {
          ForEach(discovery.helpers) { helper in
            Button {
              helperURL = helper.baseURL?.absoluteString ?? helperURL
            } label: {
              HStack(spacing: 12) {
                Image(systemName: "shippingbox.and.arrow.backward")
                  .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 3) {
                  Text(helper.name)
                    .foregroundStyle(.primary)
                  Text(discoveredHelperDetail(helper))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Spacer()
                if helper.baseURL?.absoluteString == helperURL {
                  Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.blue)
                }
              }
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("helper-discovered-\(helper.id)")
          }
        }
      } header: {
        Text("附近 Helper")
      } footer: {
        Text("配对码显示在 Helper 主机的终端里。")
      }

      Section("手动连接") {
        TextField("http://nas.local:17890", text: $helperURL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .keyboardType(.URL)
          .accessibilityIdentifier("helper-url-field")

        TextField("六位配对码", text: $pairingCode)
          .textInputAutocapitalization(.characters)
          .autocorrectionDisabled()
          .onChange(of: pairingCode) { _, value in
            pairingCode = String(
              value.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }.prefix(6)
            )
          }
          .accessibilityIdentifier("helper-code-field")

        Button(isBusy ? String(localized: "正在连接") : String(localized: "连接 Helper")) {
          Task {
            await model.pairHelper(
              serverID: serverID,
              baseURLText: helperURL,
              pairingCode: pairingCode
            )
            if case .connected = model.helperConnectionState(for: serverID) {
              pairingCode = ""
            }
          }
        }
        .disabled(isBusy || pairingCode.count != 6 || helperURL.isEmpty)
        .accessibilityIdentifier("helper-connect")
      }

      if let errorMessage {
        Section("无法连接") {
          Label(errorMessage, systemImage: "exclamationmark.triangle")
            .foregroundStyle(.orange)
        }
      }

      Section {
        Label("每台设备使用独立 Token，并仅保存在本机 Keychain。", systemImage: "key")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  private var isBusy: Bool {
    model.helperConnectionState(for: serverID) == .connecting
  }

  private var server: ServerConfiguration? {
    model.servers.first { $0.id == serverID }
  }

  private func discoveredHelperDetail(_ helper: DiscoveredHelper) -> String {
    let endpoint = "\(helper.host):\(helper.port)"
    return helper.version.isEmpty ? endpoint : "\(endpoint) · v\(helper.version)"
  }
}
