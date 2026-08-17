import Observation
import SwiftUI
import UIKit

struct TorrentImportDraft: Sendable {
  let displayTitle: String?
  let locksSource: Bool
  let sourceText: String

  static var empty: TorrentImportDraft {
    TorrentImportDraft(displayTitle: nil, locksSource: false, sourceText: "")
  }
}

@MainActor
@Observable
private final class TorrentImportState {
  var errorMessage: String?
  var isSubmitting = false
  var selectedServerID: UUID?
  var sourceText: String

  init(draft: TorrentImportDraft, selectedServerID: UUID?) {
    sourceText = draft.sourceText
    self.selectedServerID = selectedServerID
  }
}

final class TorrentImportViewController: SwiftUIHostingViewController {
  private let draft: TorrentImportDraft
  private let model: AppModel
  private let state: TorrentImportState
  private var onCompletion: ((ServerConfiguration) -> Void)?

  init(model: AppModel, draft: TorrentImportDraft) {
    self.model = model
    self.draft = draft
    state = TorrentImportState(draft: draft, selectedServerID: model.activeServerID)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "添加 Torrent"
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancel)
    )
    navigationItem.leftBarButtonItem?.accessibilityIdentifier = "torrent-import-cancel"

    host(
      TorrentImportContentView(
        draft: draft,
        onSubmit: { [weak self] in
          self?.submit()
        }
      )
      .environment(model)
      .environment(state)
    )
  }

  static func present(
    from presenter: UIViewController,
    model: AppModel,
    draft: TorrentImportDraft,
    onCompletion: @escaping (ServerConfiguration) -> Void
  ) {
    let controller = TorrentImportViewController(model: model, draft: draft)
    controller.onCompletion = onCompletion

    let navigationController = UINavigationController(rootViewController: controller)
    navigationController.modalPresentationStyle = .pageSheet
    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.selectedDetentIdentifier = .medium
      sheet.prefersGrabberVisible = true
    }
    presenter.present(navigationController, animated: true)
  }

  static func presentSuccess(on presenter: UIViewController, server: ServerConfiguration) {
    let alert = UIAlertController(
      title: "已提交到 \(server.name)",
      message: "qBittorrent 已接收此 Torrent；任务状态将在列表刷新后显示。",
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "完成", style: .default))
    presenter.present(alert, animated: true)
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  private func submit() {
    guard let serverID = state.selectedServerID else {
      state.errorMessage = TorrentImportError.serverUnavailable.localizedDescription
      return
    }

    state.isSubmitting = true
    state.errorMessage = nil
    Task {
      do {
        let server = try await model.addTorrent(sourceText: state.sourceText, to: serverID)
        state.isSubmitting = false
        dismiss(animated: true) { [onCompletion] in
          onCompletion?(server)
        }
      } catch {
        state.isSubmitting = false
        state.errorMessage = error.localizedDescription
      }
    }
  }
}

private struct TorrentImportContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentImportState.self) private var state

  let draft: TorrentImportDraft
  let onSubmit: () -> Void

  var body: some View {
    @Bindable var state = state

    Form {
      Section("来源") {
        if let displayTitle = draft.displayTitle {
          LabeledContent("条目") {
            Text(displayTitle)
              .lineLimit(2)
              .multilineTextAlignment(.trailing)
          }
        }

        if draft.locksSource {
          LabeledContent("Torrent URL") {
            Text(state.sourceText)
              .font(.caption.monospaced())
              .foregroundStyle(.secondary)
              .lineLimit(3)
              .multilineTextAlignment(.trailing)
              .textSelection(.enabled)
          }
          .accessibilityIdentifier("torrent-import-source")
        } else {
          TextField("Magnet 或 Torrent URL", text: $state.sourceText, axis: .vertical)
            .lineLimit(2...5)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
            .accessibilityIdentifier("torrent-import-source")
        }
      }

      Section {
        if model.servers.isEmpty {
          Label("尚未配置服务器", systemImage: "externaldrive.badge.exclamationmark")
            .foregroundStyle(.secondary)
        } else {
          Picker("服务器", selection: $state.selectedServerID) {
            ForEach(model.servers) { server in
              Text(server.name).tag(Optional(server.id))
            }
          }
          .accessibilityIdentifier("torrent-import-target")
        }
      } header: {
        Text("目标服务器")
      } footer: {
        Text("本批使用服务器默认保存路径；保存路径、分类和标签将在高级选项批次接入。")
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-import-error")
        }
      }
    }
    .accessibilityIdentifier("torrent-import-sheet")
    .safeAreaInset(edge: .bottom) {
      Button(action: onSubmit) {
        HStack {
          if state.isSubmitting {
            ProgressView()
              .tint(.white)
          } else {
            Image(systemName: "arrow.down.circle.fill")
          }
          Text(confirmTitle)
            .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
      .disabled(!canSubmit)
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
      .background(.bar)
      .accessibilityIdentifier("torrent-import-confirm")
    }
  }

  private var canSubmit: Bool {
    !state.isSubmitting
      && state.selectedServerID != nil
      && !state.sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private var confirmTitle: String {
    guard
      let selectedServerID = state.selectedServerID,
      let server = model.servers.first(where: { $0.id == selectedServerID })
    else {
      return "选择目标服务器"
    }
    return state.isSubmitting ? "正在添加到 \(server.name)" : "添加到 \(server.name)"
  }
}
