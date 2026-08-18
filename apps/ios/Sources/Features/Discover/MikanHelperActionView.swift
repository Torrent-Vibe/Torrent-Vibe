import Observation
import SwiftUI
import UIKit

enum MikanHelperActionKind: Sendable {
  case backfill
  case subscribe
}

enum MikanHelperActionSuccess: Sendable {
  case backfilled(HelperBackfillOutcome)
  case subscribed(HelperSubscriptionOutcome)
}

@MainActor
@Observable
private final class MikanHelperActionState {
  var errorMessage: String?
  var isSubmitting = false
  var selectedServerID: UUID?
  var selectedServerIDs: Set<UUID>

  init(model: AppModel) {
    let available = model.pairedHelperServers
    let preferred = available.first(where: { $0.id == model.activeServerID }) ?? available.first
    selectedServerID = preferred?.id
    selectedServerIDs = preferred.map { [$0.id] } ?? []
  }
}

final class MikanHelperActionViewController: SwiftUIHostingViewController {
  private let action: MikanHelperActionKind
  private let baseURL: URL
  private let detail: MikanBangumiDetail
  private let model: AppModel
  private let state: MikanHelperActionState
  private let subgroup: MikanSubgroup
  private var onCompletion: ((MikanHelperActionSuccess) -> Void)?

  init(
    action: MikanHelperActionKind,
    baseURL: URL,
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    model: AppModel
  ) {
    self.action = action
    self.baseURL = baseURL
    self.detail = detail
    self.subgroup = subgroup
    self.model = model
    state = MikanHelperActionState(model: model)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = action == .subscribe ? "持续订阅" : "导入已出"
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancel)
    )
    navigationItem.leftBarButtonItem?.accessibilityIdentifier = "mikan-helper-action-cancel"
    view.backgroundColor = .systemGroupedBackground

    host(
      MikanHelperActionContentView(
        action: action,
        detail: detail,
        subgroup: subgroup,
        onSubmit: { [weak self] in self?.submit() }
      )
      .environment(model)
      .environment(state)
    )
  }

  static func present(
    from presenter: UIViewController,
    action: MikanHelperActionKind,
    baseURL: URL,
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    model: AppModel,
    onCompletion: @escaping (MikanHelperActionSuccess) -> Void
  ) {
    let controller = MikanHelperActionViewController(
      action: action,
      baseURL: baseURL,
      detail: detail,
      subgroup: subgroup,
      model: model
    )
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

  @objc private func cancel() {
    dismiss(animated: true)
  }

  private func submit() {
    state.isSubmitting = true
    state.errorMessage = nil
    Task {
      do {
        let success: MikanHelperActionSuccess
        switch action {
        case .subscribe:
          success = .subscribed(
            try await model.subscribeToMikan(
              detail: detail,
              subgroup: subgroup,
              baseURL: baseURL,
              serverIDs: state.selectedServerIDs
            )
          )
        case .backfill:
          guard let serverID = state.selectedServerID else {
            throw HelperContentError.noTarget
          }
          success = .backfilled(
            try await model.backfillMikan(
              detail: detail,
              subgroup: subgroup,
              serverID: serverID
            )
          )
        }
        state.isSubmitting = false
        dismiss(animated: true) { [onCompletion] in onCompletion?(success) }
      } catch {
        state.isSubmitting = false
        state.errorMessage = error.localizedDescription
      }
    }
  }
}

private struct MikanHelperActionContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(MikanHelperActionState.self) private var state

  let action: MikanHelperActionKind
  let detail: MikanBangumiDetail
  let subgroup: MikanSubgroup
  let onSubmit: () -> Void

  var body: some View {
    @Bindable var state = state

    Form {
      Section("内容") {
        LabeledContent("番组", value: detail.title)
        LabeledContent("字幕组", value: subgroup.name)
        if action == .backfill {
          LabeledContent("已发布剧集", value: "\(episodeCount)")
            .accessibilityIdentifier("mikan-helper-backfill-count")
        }
      }

      Section {
        if model.pairedHelperServers.isEmpty {
          Label("没有已配对的 Helper", systemImage: "externaldrive.badge.exclamationmark")
            .foregroundStyle(.secondary)
        } else if action == .subscribe {
          ForEach(model.pairedHelperServers) { server in
            Toggle(server.name, isOn: targetBinding(server.id))
              .accessibilityIdentifier("mikan-helper-target-\(server.id.uuidString)")
          }
        } else {
          Picker("服务器", selection: $state.selectedServerID) {
            ForEach(model.pairedHelperServers) { server in
              Text(server.name).tag(Optional(server.id))
            }
          }
          .accessibilityIdentifier("mikan-helper-backfill-target")
        }
      } header: {
        Text("目标 Helper")
      } footer: {
        Text(footerText)
      }

      if let errorMessage = state.errorMessage {
        Section {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .foregroundStyle(.red)
            .accessibilityIdentifier("mikan-helper-action-error")
        }
      }
    }
    .accessibilityIdentifier("mikan-helper-action-sheet")
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
      .accessibilityIdentifier(
        action == .subscribe ? "mikan-helper-subscribe-confirm" : "mikan-helper-backfill-confirm"
      )
    }
  }

  private var episodeCount: Int {
    detail.episodes.count { $0.subgroupId == subgroup.id }
  }

  private var canSubmit: Bool {
    guard !state.isSubmitting else { return false }
    switch action {
    case .subscribe:
      return !state.selectedServerIDs.isEmpty
    case .backfill:
      return state.selectedServerID != nil && episodeCount > 0
    }
  }

  private var confirmTitle: String {
    if state.isSubmitting {
      return action == .subscribe ? "正在订阅" : "正在提交"
    }
    return action == .subscribe ? "开始持续订阅" : "导入 \(episodeCount) 个已出剧集"
  }

  private var footerText: String {
    switch action {
    case .subscribe:
      "Helper 是订阅真相源；可同时选择多台已配对服务器。"
    case .backfill:
      "这是一次性导入，不会创建持续订阅，也不会改变现有订阅。"
    }
  }

  private func targetBinding(_ serverID: UUID) -> Binding<Bool> {
    Binding(
      get: { state.selectedServerIDs.contains(serverID) },
      set: { isSelected in
        if isSelected {
          state.selectedServerIDs.insert(serverID)
        } else {
          state.selectedServerIDs.remove(serverID)
        }
      }
    )
  }
}
