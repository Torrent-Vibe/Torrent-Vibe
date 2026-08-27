import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class TorrentManagementState {
  var categoryText: String
  var downloadLimitText: String
  var errorMessage: String?
  var isSaving = false
  var tagsText: String
  var uploadLimitText: String

  init(torrent: TorrentSummary) {
    categoryText = torrent.category ?? ""
    tagsText = torrent.tags.joined(separator: ", ")
    downloadLimitText = TorrentInput.mebibytesText(for: torrent.downloadLimit)
    uploadLimitText = TorrentInput.mebibytesText(for: torrent.uploadLimit)
  }

  func request() throws -> TorrentManagementRequest {
    try TorrentManagementRequest(
      category: categoryText,
      tags: TorrentInput.tags(from: tagsText),
      downloadLimit: TorrentInput.bytesPerSecond(from: downloadLimitText),
      uploadLimit: TorrentInput.bytesPerSecond(from: uploadLimitText)
    )
  }
}

final class TorrentManagementViewController: SwiftUIHostingViewController {
  private let model: AppModel
  private let serverID: UUID
  private let state: TorrentManagementState
  private let torrentID: String
  private var onCompletion: ((TorrentSummary) -> Void)?

  init(model: AppModel, torrent: TorrentSummary, serverID: UUID) {
    self.model = model
    self.serverID = serverID
    torrentID = torrent.id
    state = TorrentManagementState(torrent: torrent)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "任务选项")
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
    navigationItem.rightBarButtonItem?.accessibilityIdentifier = "torrent-management-save"
    host(TorrentManagementContentView().environment(state))
  }

  static func present(
    from presenter: UIViewController,
    model: AppModel,
    torrent: TorrentSummary,
    serverID: UUID,
    onCompletion: @escaping (TorrentSummary) -> Void
  ) {
    let controller = TorrentManagementViewController(
      model: model,
      torrent: torrent,
      serverID: serverID
    )
    controller.onCompletion = onCompletion
    let navigationController = UINavigationController(rootViewController: controller)
    navigationController.modalPresentationStyle = .formSheet
    presenter.present(navigationController, animated: true)
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  @objc private func save() {
    do {
      let request = try state.request()
      state.isSaving = true
      state.errorMessage = nil
      navigationItem.rightBarButtonItem?.isEnabled = false
      Task {
        do {
          let updated = try await model.updateTorrentManagement(
            torrentID: torrentID,
            request: request,
            serverID: serverID
          )
          state.isSaving = false
          dismiss(animated: true) { [onCompletion] in
            onCompletion?(updated)
          }
        } catch {
          state.isSaving = false
          state.errorMessage = error.localizedDescription
          navigationItem.rightBarButtonItem?.isEnabled = true
        }
      }
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }
}

private struct TorrentManagementContentView: View {
  @Environment(TorrentManagementState.self) private var state

  var body: some View {
    @Bindable var state = state

    Form {
      Section("整理") {
        TextField("分类", text: $state.categoryText)
          .textInputAutocapitalization(.never)
          .accessibilityIdentifier("torrent-management-category")
        TextField("标签，以逗号分隔", text: $state.tagsText)
          .accessibilityIdentifier("torrent-management-tags")
      }

      Section {
        TextField("下载限速（MB/s）", text: $state.downloadLimitText)
          .keyboardType(.decimalPad)
          .accessibilityIdentifier("torrent-management-download-limit")
        TextField("上传限速（MB/s）", text: $state.uploadLimitText)
          .keyboardType(.decimalPad)
          .accessibilityIdentifier("torrent-management-upload-limit")
      } header: {
        Text("传输限速")
      } footer: {
        Text("0 表示不限速。")
      }

      if state.isSaving {
        Section {
          HStack {
            ProgressView()
            Text("正在保存")
          }
          .accessibilityIdentifier("torrent-management-saving")
        }
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-management-error")
        }
      }
    }
    .disabled(state.isSaving)
    .accessibilityIdentifier("torrent-management-sheet")
  }
}
