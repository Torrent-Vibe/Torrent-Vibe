import Observation
import SwiftUI
import UIKit

@MainActor
protocol MTeamBatchTorrentAdding: AnyObject {
  @discardableResult
  func addTorrent(
    _ request: TorrentAddRequest,
    to serverID: UUID
  ) async throws -> ServerConfiguration
}

extension AppModel: MTeamBatchTorrentAdding {}

struct MTeamBatchImportOptions: Equatable, Sendable {
  let category: String?
  let downloadLimit: Int64?
  let savePath: String?
  let tags: [String]
  let uploadLimit: Int64?

  func request(downloadURL: URL) -> TorrentAddRequest {
    TorrentAddRequest(
      source: .url(downloadURL.absoluteString),
      savePath: savePath,
      category: category,
      tags: tags,
      downloadLimit: downloadLimit,
      uploadLimit: uploadLimit
    )
  }
}

@MainActor
@Observable
final class MTeamBatchImportCoordinator {
  var categoryText = ""
  var downloadLimitText = ""
  var errorMessage: String?
  var failures: [String: String] = [:]
  var isAdvancedOptionsExpanded = false
  var isSubmitting = false
  var savePathText = ""
  var selectedServerID: UUID?
  var succeededIDs = Set<String>()
  var tagsText = ""
  var uploadLimitText = ""

  let torrents: [MTeamTorrent]

  private let configuration: MTeamProviderConfiguration
  private let model: any MTeamBatchTorrentAdding
  private let service: any MTeamService

  init(
    torrents: [MTeamTorrent],
    configuration: MTeamProviderConfiguration,
    service: any MTeamService,
    model: any MTeamBatchTorrentAdding,
    selectedServerID: UUID?
  ) {
    self.torrents = torrents
    self.configuration = configuration
    self.service = service
    self.model = model
    self.selectedServerID = selectedServerID
  }

  var pendingTorrents: [MTeamTorrent] {
    torrents.filter { !succeededIDs.contains($0.id) }
  }

  var progressText: String {
    if succeededIDs.isEmpty, failures.isEmpty {
      return String(localized: "确认后才会为所选资源生成临时下载链接。")
    }
    return String(localized: "已添加 \(succeededIDs.count) 项 · 待处理 \(pendingTorrents.count) 项")
  }

  func importPending() async throws -> Int {
    guard let selectedServerID else {
      throw TorrentImportError.serverUnavailable
    }
    let options = try makeOptions()
    let pending = pendingTorrents
    guard !pending.isEmpty else { return succeededIDs.count }

    isSubmitting = true
    errorMessage = nil
    failures = [:]
    defer { isSubmitting = false }

    for torrent in pending {
      do {
        let downloadURL = try await service.downloadURL(
          configuration: configuration,
          torrentID: torrent.id
        )
        _ = try await model.addTorrent(
          options.request(downloadURL: downloadURL),
          to: selectedServerID
        )
        succeededIDs.insert(torrent.id)
      } catch is CancellationError {
        throw CancellationError()
      } catch {
        failures[torrent.id] = error.localizedDescription
      }
    }

    if !failures.isEmpty {
      errorMessage = String(localized: "\(failures.count) 项未能添加；重试只会处理失败项目。")
    }
    return succeededIDs.count
  }

  private func makeOptions() throws -> MTeamBatchImportOptions {
    MTeamBatchImportOptions(
      category: normalized(categoryText),
      downloadLimit: try TorrentInput.optionalBytesPerSecond(from: downloadLimitText),
      savePath: normalized(savePathText),
      tags: TorrentInput.tags(from: tagsText),
      uploadLimit: try TorrentInput.optionalBytesPerSecond(from: uploadLimitText)
    )
  }

  private func normalized(_ value: String) -> String? {
    let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? nil : value
  }
}

final class MTeamBatchImportViewController: SwiftUIHostingViewController {
  private let coordinator: MTeamBatchImportCoordinator
  private let model: AppModel
  private var onCompletion: ((Int) -> Void)?

  init(
    torrents: [MTeamTorrent],
    configuration: MTeamProviderConfiguration,
    service: any MTeamService,
    model: AppModel
  ) {
    self.model = model
    coordinator = MTeamBatchImportCoordinator(
      torrents: torrents,
      configuration: configuration,
      service: service,
      model: model,
      selectedServerID: model.activeServerID
    )
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = String(localized: "批量导入（\(coordinator.torrents.count)）")
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancel)
    )
    navigationItem.leftBarButtonItem?.accessibilityIdentifier = "mteam-batch-cancel"
    host(
      MTeamBatchImportContentView(
        onConfirm: { [weak self] in
          self?.performImport()
        }
      )
      .environment(model)
      .environment(coordinator)
    )
  }

  static func present(
    from presenter: UIViewController,
    torrents: [MTeamTorrent],
    configuration: MTeamProviderConfiguration,
    service: any MTeamService,
    model: AppModel,
    onCompletion: @escaping () -> Void
  ) {
    let controller = MTeamBatchImportViewController(
      torrents: torrents,
      configuration: configuration,
      service: service,
      model: model
    )
    controller.onCompletion = { [weak presenter] count in
      onCompletion()
      let alert = UIAlertController(
        title: String(localized: "批量导入已提交"),
        message: String(localized: "已向目标服务器添加 \(count) 个任务。"),
        preferredStyle: .alert
      )
      alert.addAction(UIAlertAction(title: String(localized: "完成"), style: .default))
      presenter?.present(alert, animated: true)
    }
    let navigationController = UINavigationController(rootViewController: controller)
    navigationController.modalPresentationStyle = .pageSheet
    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.selectedDetentIdentifier = .large
      sheet.prefersGrabberVisible = true
    }
    presenter.present(navigationController, animated: true)
  }

  @objc private func cancel() {
    dismiss(animated: true)
  }

  private func performImport() {
    Task { [self] in
      do {
        let completedCount = try await coordinator.importPending()
        guard coordinator.pendingTorrents.isEmpty else { return }
        dismiss(animated: true) { [weak self] in
          self?.onCompletion?(completedCount)
        }
      } catch is CancellationError {
        return
      } catch {
        coordinator.errorMessage = error.localizedDescription
      }
    }
  }
}

private struct MTeamBatchImportContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MTeamBatchImportCoordinator.self) private var coordinator

  let onConfirm: () -> Void

  var body: some View {
    @Bindable var coordinator = coordinator

    Form {
      Section("目标服务器") {
        Picker("服务器", selection: $coordinator.selectedServerID) {
          Text("请选择").tag(UUID?.none)
          ForEach(model.servers) { server in
            Text(server.name).tag(UUID?.some(server.id))
          }
        }
        .accessibilityIdentifier("mteam-batch-server")
      }

      Section {
        ForEach(coordinator.torrents) { torrent in
          HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: statusImage(for: torrent.id))
              .foregroundStyle(statusColor(for: torrent.id))
              .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
              Text(torrent.title)
                .lineLimit(2)
              if let failure = coordinator.failures[torrent.id] {
                Text(failure)
                  .font(.caption)
                  .foregroundStyle(.red)
                  .lineLimit(2)
              }
            }
          }
        }
      } header: {
        Text("所选资源")
      } footer: {
        Text(coordinator.progressText)
          .accessibilityIdentifier("mteam-batch-progress")
      }

      Section {
        DisclosureGroup("公共选项", isExpanded: $coordinator.isAdvancedOptionsExpanded) {
          TextField("保存路径（可选）", text: $coordinator.savePathText)
            .textInputAutocapitalization(.never)
          TextField("分类（可选）", text: $coordinator.categoryText)
          TextField("标签，以逗号分隔", text: $coordinator.tagsText)
          TextField("下载限速 MB/s", text: $coordinator.downloadLimitText)
            .keyboardType(.decimalPad)
          TextField("上传限速 MB/s", text: $coordinator.uploadLimitText)
            .keyboardType(.decimalPad)
        }
        .accessibilityIdentifier("mteam-batch-options")
      }

      if let errorMessage = coordinator.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("mteam-batch-error")
        }
      }

      Section {
        Button(action: onConfirm) {
          HStack {
            Spacer()
            if coordinator.isSubmitting {
              ProgressView()
            } else {
              Text(confirmTitle)
            }
            Spacer()
          }
        }
        .disabled(coordinator.isSubmitting || coordinator.selectedServerID == nil)
        .accessibilityIdentifier("mteam-batch-confirm")
      } footer: {
        Text("重试只会处理失败的项目。")
      }
    }
  }

  private var confirmTitle: String {
    let count = coordinator.pendingTorrents.count
    return coordinator.failures.isEmpty ? String(localized: "确认导入 \(count) 项") : String(localized: "重试失败的 \(count) 项")
  }

  private func statusImage(for torrentID: String) -> String {
    if coordinator.succeededIDs.contains(torrentID) {
      return "checkmark.circle.fill"
    }
    if coordinator.failures[torrentID] != nil {
      return "exclamationmark.circle.fill"
    }
    return "circle"
  }

  private func statusColor(for torrentID: String) -> Color {
    if coordinator.succeededIDs.contains(torrentID) {
      return .green
    }
    if coordinator.failures[torrentID] != nil {
      return .red
    }
    return .secondary
  }
}
