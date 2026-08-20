import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
private final class MikanHelperActionState {
  var errorMessage: String?
  var isSubmitting = false
  var selectedServerIDs: Set<UUID>

  init(model: AppModel) {
    let available = model.pairedHelperServers
    let preferred = available.first(where: { $0.id == model.activeServerID }) ?? available.first
    selectedServerIDs = preferred.map { [$0.id] } ?? []
  }
}

final class MikanHelperActionViewController: SwiftUIHostingViewController {
  private let baseURL: URL
  private let detail: MikanBangumiDetail
  private let model: AppModel
  private let state: MikanHelperActionState
  private let subgroup: MikanSubgroup
  private var onCompletion: ((HelperSubscriptionOutcome) -> Void)?

  init(
    baseURL: URL,
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    model: AppModel
  ) {
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
    title = "订阅"
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
    baseURL: URL,
    detail: MikanBangumiDetail,
    subgroup: MikanSubgroup,
    model: AppModel,
    onCompletion: @escaping (HelperSubscriptionOutcome) -> Void
  ) {
    let controller = MikanHelperActionViewController(
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
        let outcome = try await model.subscribeToMikan(
          detail: detail,
          subgroup: subgroup,
          baseURL: baseURL,
          serverIDs: state.selectedServerIDs
        )
        state.isSubmitting = false
        dismiss(animated: true) { [onCompletion] in onCompletion?(outcome) }
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

  let detail: MikanBangumiDetail
  let subgroup: MikanSubgroup
  let onSubmit: () -> Void

  var body: some View {
    @Bindable var state = state

    Form {
      Section("内容") {
        LabeledContent("番组", value: detail.title)
        LabeledContent("字幕组", value: subgroup.name)
        LabeledContent("已发布剧集", value: "\(episodeCount)")
          .accessibilityIdentifier("mikan-helper-backfill-count")
      }

      Section {
        if model.pairedHelperServers.isEmpty {
          Label("没有已配对的 Helper", systemImage: "externaldrive.badge.exclamationmark")
            .foregroundStyle(.secondary)
        } else {
          ForEach(model.pairedHelperServers) { server in
            Toggle(server.name, isOn: targetBinding(server.id))
              .accessibilityIdentifier("mikan-helper-target-\(server.id.uuidString)")
          }
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
      .accessibilityIdentifier("mikan-helper-subscribe-confirm")
    }
  }

  private var episodeCount: Int {
    detail.episodes.count { $0.subgroupId == subgroup.id }
  }

  private var canSubmit: Bool {
    !state.isSubmitting && !state.selectedServerIDs.isEmpty
  }

  private var confirmTitle: String {
    state.isSubmitting ? "正在订阅" : "订阅"
  }

  private var footerText: String {
    "Helper 是订阅真相源，可同时选择多台已配对服务器；订阅后会持续拉取更新，并导入本季已发布的剧集，而不仅是之后更新的剧集。"
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
