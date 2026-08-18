import SwiftUI
import UIKit

final class ShareViewController: UIViewController {
  private lazy var model = ShareImportModel()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground

    let hostingController = UIHostingController(
      rootView: TorrentShareView(
        model: model,
        onCancel: { [weak self] in self?.cancelRequest() }
      )
    )
    addChild(hostingController)
    hostingController.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(hostingController.view)
    NSLayoutConstraint.activate([
      hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
      hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    hostingController.didMove(toParent: self)

    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    model.load(inputItems: items)
  }

  private func cancelRequest() {
    model.cancel()
    let error = NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)
    extensionContext?.cancelRequest(withError: error)
  }
}

private struct TorrentShareView: View {
  @Bindable var model: ShareImportModel

  let onCancel: () -> Void

  var body: some View {
    NavigationStack {
      VStack(spacing: 20) {
        Image(systemName: sourceImageName)
          .font(.system(size: 42, weight: .semibold))
          .foregroundStyle(model.phase == .failed ? Color.red : Color.accentColor)
          .symbolEffect(.pulse, isActive: model.phase == .loading)

        VStack(spacing: 8) {
          Text(model.sourceTitle)
            .font(.headline)
            .multilineTextAlignment(.center)
            .accessibilityIdentifier("share-extension-source")
          Text(model.sourceDetail)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(4)
            .multilineTextAlignment(.center)
            .textSelection(.enabled)
        }

        if let errorMessage = model.errorMessage {
          Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
            .font(.footnote)
            .foregroundStyle(.red)
            .multilineTextAlignment(.center)
            .accessibilityIdentifier("share-extension-error")
        }

        Link(destination: model.handoffURL) {
          Text(model.isOpeningApp ? "正在打开…" : "在 Torrent Vibe 中继续")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
        .disabled(model.phase != .ready || model.isOpeningApp)
        .simultaneousGesture(
          TapGesture().onEnded {
            model.beginHandoff()
          }
        )
        .accessibilityIdentifier("share-extension-continue")
      }
      .padding(24)
      .navigationTitle("添加 Torrent")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("取消", action: onCancel)
            .accessibilityIdentifier("share-extension-cancel")
        }
      }
    }
    .accessibilityIdentifier("share-extension-view")
  }

  private var sourceImageName: String {
    guard let payload = model.payload else {
      return model.phase == .failed ? "xmark.circle" : "arrow.trianglehead.2.clockwise"
    }
    switch payload.source {
    case .link:
      return "link"
    case .file:
      return "doc.badge.plus"
    }
  }
}
