import IslandToast
import Observation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct TorrentImportDraft: Sendable {
  let displayTitle: String?
  let fileData: Data?
  let fileName: String?
  let locksSource: Bool
  let sourceFooterText: String?
  let sourceText: String

  init(
    displayTitle: String?,
    locksSource: Bool,
    sourceText: String,
    fileName: String? = nil,
    fileData: Data? = nil,
    sourceFooterText: String? = nil
  ) {
    self.displayTitle = displayTitle
    self.fileData = fileData
    self.fileName = fileName
    self.locksSource = locksSource
    self.sourceFooterText = sourceFooterText
    self.sourceText = sourceText
  }

  static var empty: TorrentImportDraft {
    TorrentImportDraft(displayTitle: nil, locksSource: false, sourceText: "")
  }

  static func shared(_ payload: TorrentSharePayload) -> TorrentImportDraft {
    switch payload.source {
    case .link(let value):
      TorrentImportDraft(
        displayTitle: String(localized: "来自系统分享"),
        locksSource: true,
        sourceText: value,
        sourceFooterText: String(localized: "此链接来自系统分享；确认目标服务器后再提交。")
      )
    case .file(let name, let data):
      TorrentImportDraft(
        displayTitle: String(localized: "来自系统分享"),
        locksSource: true,
        sourceText: "",
        fileName: name,
        fileData: data,
        sourceFooterText: String(localized: "此文件来自系统分享；确认目标服务器后再提交。")
      )
    }
  }

  static func shortcut(_ payload: TorrentSharePayload) -> TorrentImportDraft {
    guard case .link(let value) = payload.source else {
      return .shared(payload)
    }
    return TorrentImportDraft(
      displayTitle: String(localized: "来自系统指令"),
      locksSource: true,
      sourceText: value,
      sourceFooterText: String(localized: "此 Magnet 来自系统指令；确认目标服务器后再提交。")
    )
  }
}

@MainActor
@Observable
private final class TorrentImportState {
  var categories: [TorrentCategory] = []
  var categoriesErrorMessage: String?
  var categoriesServerID: UUID?
  var categoryText = ""
  var createsRootFolder = false
  var downloadLimitText = ""
  var errorMessage: String?
  var fileData: Data?
  var fileName: String?
  var isAutomaticTorrentManagementEnabled = false
  var isFirstLastPiecePriorityEnabled = false
  var isLoadingCategories = false
  var isSequentialDownloadEnabled = false
  var isShowingSettings = false
  var isSubmitting = false
  var renameText = ""
  var savePathText = ""
  var selectedServerID: UUID?
  var skipsHashChecking = false
  var sourceText: String
  var startsImmediately = true
  var tagsText = ""
  var uploadLimitText = ""

  init(draft: TorrentImportDraft, selectedServerID: UUID?) {
    fileData = draft.fileData
    fileName = draft.fileName
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

  func clearLink() {
    sourceText = ""
    errorMessage = nil
  }

  func loadCategories(using model: AppModel, force: Bool = false) async {
    guard let serverID = selectedServerID else {
      categories = []
      categoriesServerID = nil
      categoryText = ""
      return
    }
    if categoriesServerID != serverID {
      categories = []
      categoriesErrorMessage = nil
      categoryText = ""
      categoriesServerID = nil
    }
    guard force || categoriesServerID != serverID else { return }

    isLoadingCategories = true
    categoriesErrorMessage = nil
    do {
      let loadedCategories = try await model.torrentCategories(serverID: serverID)
      try Task.checkCancellation()
      guard selectedServerID == serverID else { return }
      categories = loadedCategories
      categoriesServerID = serverID
      isLoadingCategories = false
    } catch is CancellationError {
      if selectedServerID == serverID {
        isLoadingCategories = false
      }
    } catch {
      guard selectedServerID == serverID else { return }
      categories = []
      categoriesServerID = nil
      categoriesErrorMessage = error.localizedDescription
      isLoadingCategories = false
    }
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
      savePath: isAutomaticTorrentManagementEnabled ? nil : savePathText,
      category: categoryText,
      tags: TorrentInput.tags(from: tagsText),
      rename: renameText,
      isAutomaticTorrentManagementEnabled: isAutomaticTorrentManagementEnabled,
      startsImmediately: startsImmediately,
      skipsHashChecking: skipsHashChecking,
      isSequentialDownloadEnabled: isSequentialDownloadEnabled,
      isFirstLastPiecePriorityEnabled: isFirstLastPiecePriorityEnabled,
      createsRootFolder: createsRootFolder,
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
    title = String(localized: "添加 Torrent")
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
        onBack: { [weak self] in
          self?.state.errorMessage = nil
          self?.state.isShowingSettings = false
        },
        onCancel: { [weak self] in
          self?.cancel()
        },
        onClearFile: { [weak self] in
          self?.state.clearFile()
        },
        onPickFile: { [weak self] in
          self?.pickFile()
        },
        onShowSettings: { [weak self] in
          self?.showSettings()
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
      sheet.detents = [.large()]
      sheet.selectedDetentIdentifier = .large
      sheet.prefersGrabberVisible = true
    }
    presenter.present(navigationController, animated: true)
  }

  static func presentSuccess(on presenter: UIViewController, server: ServerConfiguration) {
    IslandToast.show(String(localized: "已提交到 \(server.name)"), from: presenter)
  }

  @objc private func cancel() {
    guard !state.isSubmitting else { return }
    dismiss(animated: true)
  }

  private func showSettings() {
    do {
      _ = try AppModel.validatedTorrentAddRequest(state.request())
      state.errorMessage = nil
      state.isShowingSettings = true
    } catch {
      state.errorMessage = error.localizedDescription
    }
  }

  private func setSubmitting(_ isSubmitting: Bool) {
    state.isSubmitting = isSubmitting
    navigationItem.leftBarButtonItem?.isEnabled = !isSubmitting
    navigationController?.isModalInPresentation = isSubmitting
  }

  private func submit() {
    guard let serverID = state.selectedServerID else {
      state.errorMessage = TorrentImportError.serverUnavailable.localizedDescription
      return
    }

    do {
      let request = try state.request()
      setSubmitting(true)
      state.errorMessage = nil
      Task {
        do {
          let server = try await model.addTorrent(request, to: serverID)
          setSubmitting(false)
          dismiss(animated: true) { [onCompletion] in
            onCompletion?(server)
          }
        } catch {
          setSubmitting(false)
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
  let onBack: () -> Void
  let onCancel: () -> Void
  let onClearFile: () -> Void
  let onPickFile: () -> Void
  let onShowSettings: () -> Void
  let onSubmit: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      TorrentImportStepHeader(isShowingSettings: state.isShowingSettings)
      Divider()
      if state.isShowingSettings {
        TorrentImportSettingsView()
      } else {
        TorrentImportSourceView(
          draft: draft,
          onClearFile: onClearFile,
          onPickFile: onPickFile
        )
      }
    }
    .accessibilityIdentifier("torrent-import-sheet")
    .safeAreaInset(edge: .bottom, spacing: 0) {
      TorrentImportFooter(
        isShowingSettings: state.isShowingSettings,
        isSubmitting: state.isSubmitting,
        primaryTitle: state.isShowingSettings ? confirmTitle : String(localized: "下一步"),
        canPerformPrimaryAction: state.isShowingSettings ? canSubmit : hasSource,
        onBack: onBack,
        onCancel: onCancel,
        onPrimaryAction: state.isShowingSettings ? onSubmit : onShowSettings
      )
    }
  }

  private var hasSource: Bool {
    state.fileData != nil
      || !state.sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private var canSubmit: Bool {
    !state.isSubmitting && !state.isLoadingCategories && state.selectedServerID != nil && hasSource
  }

  private var confirmTitle: String {
    guard
      let selectedServerID = state.selectedServerID,
      let server = model.servers.first(where: { $0.id == selectedServerID })
    else {
      return String(localized: "选择目标服务器")
    }
    return state.isSubmitting
      ? String(localized: "正在添加到 \(server.name)")
      : String(localized: "添加到 \(server.name)")
  }
}

private struct TorrentImportStepHeader: View {
  let isShowingSettings: Bool

  var body: some View {
    HStack(spacing: 12) {
      step(
        number: 1, title: String(localized: "来源"), isActive: !isShowingSettings,
        isCompleted: isShowingSettings)
        .accessibilityIdentifier("torrent-import-step-source")
      Capsule()
        .fill(isShowingSettings ? Color.accentColor : Color.secondary.opacity(0.25))
        .frame(height: 2)
        .accessibilityHidden(true)
      step(
        number: 2, title: String(localized: "设置"), isActive: isShowingSettings, isCompleted: false)
        .accessibilityIdentifier("torrent-import-step-settings")
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 14)
    .background(Color(uiColor: .secondarySystemGroupedBackground))
  }

  private func step(
    number: Int,
    title: String,
    isActive: Bool,
    isCompleted: Bool
  ) -> some View {
    HStack(spacing: 6) {
      Image(systemName: isCompleted ? "checkmark.circle.fill" : "\(number).circle.fill")
        .imageScale(.medium)
      Text(title)
        .font(.subheadline.weight(isActive ? .semibold : .regular))
    }
    .foregroundStyle(isActive || isCompleted ? Color.accentColor : Color.secondary)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("第 \(number) 步，共 2 步：\(title)")
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }
}

private struct TorrentImportSourceView: View {
  @Environment(TorrentImportState.self) private var state

  let draft: TorrentImportDraft
  let onClearFile: () -> Void
  let onPickFile: () -> Void

  var body: some View {
    @Bindable var state = state

    Form {
      if let displayTitle = draft.displayTitle {
        Section("导入来源") {
          Text(displayTitle)
            .accessibilityIdentifier("torrent-import-origin")
        }
      }

      Section {
        if let fileName = state.fileName {
          LabeledContent("Torrent 文件") {
            Text(fileName)
              .lineLimit(2)
              .multilineTextAlignment(.trailing)
          }
          .accessibilityIdentifier("torrent-import-file-name")
          if !draft.locksSource {
            Button("重新选择", action: onClearFile)
              .accessibilityIdentifier("torrent-import-file-clear")
          }
        } else if draft.locksSource {
          Text(state.sourceText)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
            .accessibilityIdentifier("torrent-import-source")
        } else {
          TextField("Magnet 或 Torrent URL", text: $state.sourceText, axis: .vertical)
            .lineLimit(4...7)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
            .textContentType(.URL)
            .accessibilityIdentifier("torrent-import-source")

          if hasLink {
            HStack {
              Label("使用链接添加", systemImage: "link")
                .font(.footnote)
                .foregroundStyle(.secondary)
              Spacer()
              Button("放弃并回退") {
                state.clearLink()
              }
              .font(.footnote)
              .accessibilityIdentifier("torrent-import-link-clear")
            }
          }
        }
      } header: {
        Text("添加种子")
      } footer: {
        Text(
          draft.sourceFooterText
            ?? (draft.locksSource
              ? String(localized: "来源由当前导入流程提供；确认设置后再提交。")
              : String(localized: "支持 Magnet、HTTP(S) Torrent URL 与本地 .torrent 文件。"))
        )
      }

      if !draft.locksSource && !hasLink && state.fileData == nil {
        Section {
          Button(action: onPickFile) {
            Label("选择 .torrent 文件", systemImage: "doc.badge.plus")
          }
          .accessibilityIdentifier("torrent-import-file-picker")
        } header: {
          Text("或")
        }
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-import-error")
        }
      }
    }
    .scrollDismissesKeyboard(.interactively)
    .accessibilityIdentifier("torrent-import-source-step")
  }

  private var hasLink: Bool {
    !state.sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }
}

private struct TorrentImportSettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentImportState.self) private var state

  var body: some View {
    @Bindable var state = state

    Form {
      Section("目标服务器") {
        if model.servers.isEmpty {
          Label("尚未配置服务器", systemImage: "externaldrive.badge.exclamationmark")
            .foregroundStyle(.secondary)
        } else {
          Picker("服务器", selection: $state.selectedServerID) {
            ForEach(model.servers) { server in
              Text(server.name).tag(Optional(server.id))
            }
          }
          .pickerStyle(.menu)
          .accessibilityIdentifier("torrent-import-target")
        }
      }

      Section {
        TorrentImportCategoryField()
        TextField("保存路径（可选）", text: $state.savePathText)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .disabled(state.isAutomaticTorrentManagementEnabled)
          .accessibilityIdentifier("torrent-import-save-path")
        TextField("重命名（可选）", text: $state.renameText)
          .accessibilityIdentifier("torrent-import-rename")
        TextField("标签，以逗号分隔", text: $state.tagsText)
          .accessibilityIdentifier("torrent-import-tags")
      } header: {
        Text("种子设置")
      } footer: {
        if state.isAutomaticTorrentManagementEnabled {
          Text("已启用自动种子管理，保存路径由目标服务器决定。")
        }
      }

      Section("选项") {
        Toggle("自动种子管理", isOn: $state.isAutomaticTorrentManagementEnabled)
          .accessibilityIdentifier("torrent-import-auto-tmm")
        Toggle("立即开始种子", isOn: $state.startsImmediately)
          .accessibilityIdentifier("torrent-import-start-immediately")
        Toggle("跳过哈希检查", isOn: $state.skipsHashChecking)
          .accessibilityIdentifier("torrent-import-skip-checking")
        Toggle("顺序下载", isOn: $state.isSequentialDownloadEnabled)
          .accessibilityIdentifier("torrent-import-sequential")
        Toggle("首末块优先", isOn: $state.isFirstLastPiecePriorityEnabled)
          .accessibilityIdentifier("torrent-import-first-last")
        Toggle("创建根文件夹", isOn: $state.createsRootFolder)
          .accessibilityIdentifier("torrent-import-root-folder")
      }

      Section {
        TextField("下载限速（MB/s）", text: $state.downloadLimitText)
          .keyboardType(.decimalPad)
          .accessibilityIdentifier("torrent-import-download-limit")
        TextField("上传限速（MB/s）", text: $state.uploadLimitText)
          .keyboardType(.decimalPad)
          .accessibilityIdentifier("torrent-import-upload-limit")
      } header: {
        Text("速度限制")
      } footer: {
        Text("留空时使用服务器设置，0 表示不限制。")
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("torrent-import-error")
        }
      }
    }
    .disabled(state.isSubmitting)
    .scrollDismissesKeyboard(.interactively)
    .accessibilityIdentifier("torrent-import-settings-step")
    .task(id: state.selectedServerID) {
      await state.loadCategories(using: model)
    }
  }

}

private struct TorrentImportCategoryField: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentImportState.self) private var state

  var body: some View {
    @Bindable var state = state

    if state.isLoadingCategories {
      LabeledContent("分类") {
        ProgressView()
      }
      .accessibilityIdentifier("torrent-import-category-loading")
    } else if let errorMessage = state.categoriesErrorMessage {
      VStack(alignment: .leading, spacing: 8) {
        Label("无法获取分类", systemImage: "exclamationmark.triangle.fill")
          .foregroundStyle(.red)
        Text(errorMessage)
          .font(.footnote)
          .foregroundStyle(.secondary)
        Button("重试") {
          Task {
            await state.loadCategories(using: model, force: true)
          }
        }
        .accessibilityIdentifier("torrent-import-category-retry")
      }
      .accessibilityIdentifier("torrent-import-category-error")
    } else {
      Picker("分类", selection: $state.categoryText) {
        Text("无分类").tag("")
        ForEach(state.categories) { category in
          Text(category.name).tag(category.name)
        }
      }
      .pickerStyle(.menu)
      .accessibilityIdentifier("torrent-import-category")

      if let category = selectedCategory, !category.savePath.isEmpty {
        LabeledContent("分类路径") {
          Text(category.savePath)
            .lineLimit(2)
            .multilineTextAlignment(.trailing)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .accessibilityIdentifier("torrent-import-category-path")
      }
    }
  }

  private var selectedCategory: TorrentCategory? {
    state.categories.first { $0.name == state.categoryText }
  }
}

private struct TorrentImportFooter: View {
  let isShowingSettings: Bool
  let isSubmitting: Bool
  let primaryTitle: String
  let canPerformPrimaryAction: Bool
  let onBack: () -> Void
  let onCancel: () -> Void
  let onPrimaryAction: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      Button(isShowingSettings ? "上一步" : "取消") {
        if isShowingSettings {
          onBack()
        } else {
          onCancel()
        }
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
      .disabled(isSubmitting)
      .frame(maxWidth: .infinity)
      .accessibilityIdentifier(
        isShowingSettings ? "torrent-import-back" : "torrent-import-footer-cancel"
      )

      Button(action: onPrimaryAction) {
        HStack(spacing: 8) {
          if isSubmitting {
            ProgressView()
          }
          Text(primaryTitle)
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
      .disabled(!canPerformPrimaryAction)
      .accessibilityIdentifier(
        isShowingSettings ? "torrent-import-confirm" : "torrent-import-next"
      )
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .background(.bar)
  }
}
