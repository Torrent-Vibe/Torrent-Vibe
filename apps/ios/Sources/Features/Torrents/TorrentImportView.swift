import Observation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

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
  var categoryText = ""
  var downloadLimitText = ""
  var errorMessage: String?
  var fileData: Data?
  var fileName: String?
  var isAdvancedOptionsExpanded = false
  var isSubmitting = false
  var savePathText = ""
  var selectedServerID: UUID?
  var sourceText: String
  var tagsText = ""
  var uploadLimitText = ""

  init(draft: TorrentImportDraft, selectedServerID: UUID?) {
    sourceText = draft.sourceText
    self.selectedServerID = selectedServerID
  }

  func selectFile(name: String, data: Data) {
    fileName = name
    fileData = data
    sourceText = ""
    errorMessage = nil
  }

  func clearFile() {
    fileName = nil
    fileData = nil
  }

  func request() throws -> TorrentAddRequest {
    let source: TorrentAddSource
    if let fileName, let fileData {
      source = .file(name: fileName, data: fileData)
    } else {
      source = .url(sourceText)
    }
    return try TorrentAddRequest(
      source: source,
      savePath: savePathText,
      category: categoryText,
      tags: TorrentInput.tags(from: tagsText),
      downloadLimit: TorrentInput.optionalBytesPerSecond(from: downloadLimitText),
      uploadLimit: TorrentInput.optionalBytesPerSecond(from: uploadLimitText)
    )
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
        onClearFile: { [weak self] in
          self?.state.clearFile()
        },
        onPickFile: { [weak self] in
          self?.pickFile()
        },
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

    do {
      let request = try state.request()
      state.isSubmitting = true
      state.errorMessage = nil
      Task {
        do {
          let server = try await model.addTorrent(request, to: serverID)
          state.isSubmitting = false
          dismiss(animated: true) { [onCompletion] in
            onCompletion?(server)
          }
        } catch {
          state.isSubmitting = false
          state.errorMessage = error.localizedDescription
        }
      }
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  private func pickFile() {
    let torrentType = UTType(filenameExtension: "torrent") ?? .data
    let picker = UIDocumentPickerViewController(
      forOpeningContentTypes: [torrentType],
      asCopy: true
    )
    picker.allowsMultipleSelection = false
    picker.delegate = self
    present(picker, animated: true)
  }
}

extension TorrentImportViewController: UIDocumentPickerDelegate {
  func documentPicker(
    _ controller: UIDocumentPickerViewController,
    didPickDocumentsAt urls: [URL]
  ) {
    guard let url = urls.first else { return }
    let hasSecurityScope = url.startAccessingSecurityScopedResource()
    defer {
      if hasSecurityScope {
        url.stopAccessingSecurityScopedResource()
      }
    }

    do {
      guard url.pathExtension.lowercased() == "torrent" else {
        throw TorrentImportError.invalidFile
      }
      let values = try url.resourceValues(forKeys: [.fileSizeKey])
      if let fileSize = values.fileSize, fileSize > 10 * 1024 * 1024 {
        throw TorrentImportError.fileTooLarge
      }
      let data = try Data(contentsOf: url, options: .mappedIfSafe)
      guard !data.isEmpty else { throw TorrentImportError.invalidFile }
      state.selectFile(name: url.lastPathComponent, data: data)
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    state.errorMessage = nil
  }
}

private struct TorrentImportContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentImportState.self) private var state

  let draft: TorrentImportDraft
  let onClearFile: () -> Void
  let onPickFile: () -> Void
  let onSubmit: () -> Void

  var body: some View {
    @Bindable var state = state

    Form {
      Section {
        if let displayTitle = draft.displayTitle {
          Text(displayTitle)
            .font(.body)
        }

        if draft.locksSource {
          Text(state.sourceText)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
            .accessibilityIdentifier("torrent-import-source")
        } else if let fileName = state.fileName {
          LabeledContent("Torrent 文件") {
            Text(fileName)
              .lineLimit(2)
              .multilineTextAlignment(.trailing)
          }
          .accessibilityIdentifier("torrent-import-file-name")
          Button("移除所选文件", role: .destructive, action: onClearFile)
            .accessibilityIdentifier("torrent-import-file-clear")
        } else {
          TextField("Magnet 或 Torrent URL", text: $state.sourceText, axis: .vertical)
            .lineLimit(3...6)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
            .textContentType(.URL)
            .accessibilityIdentifier("torrent-import-source")
          Button(action: onPickFile) {
            Label("选取 .torrent 文件", systemImage: "doc.badge.plus")
          }
          .accessibilityIdentifier("torrent-import-file-picker")
        }
      } header: {
        Text("来源")
      } footer: {
        Text(
          draft.locksSource
            ? "此链接来自当前剧集，提交后由目标服务器下载。"
            : "支持 Magnet、HTTP(S) Torrent URL 与本地 .torrent 文件。"
        )
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
      }

      Section {
        DisclosureGroup("高级选项", isExpanded: $state.isAdvancedOptionsExpanded) {
          TextField("保存路径（使用服务器路径）", text: $state.savePathText)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("torrent-import-save-path")
          TextField("分类", text: $state.categoryText)
            .textInputAutocapitalization(.never)
            .accessibilityIdentifier("torrent-import-category")
          TextField("标签，以逗号分隔", text: $state.tagsText)
            .accessibilityIdentifier("torrent-import-tags")
          TextField("下载限速（MB/s）", text: $state.downloadLimitText)
            .keyboardType(.decimalPad)
            .accessibilityIdentifier("torrent-import-download-limit")
          TextField("上传限速（MB/s）", text: $state.uploadLimitText)
            .keyboardType(.decimalPad)
            .accessibilityIdentifier("torrent-import-upload-limit")
        }
        .accessibilityIdentifier("torrent-import-advanced")
      } footer: {
        Text("路径留空时使用服务器默认值；限速留空时使用服务器设置，0 表示不限制。")
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
        Text(confirmTitle)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
      .disabled(!canSubmit)
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .accessibilityIdentifier("torrent-import-confirm")
    }
  }

  private var canSubmit: Bool {
    let hasSource =
      state.fileData != nil
      || !state.sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    return !state.isSubmitting && state.selectedServerID != nil && hasSource
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
