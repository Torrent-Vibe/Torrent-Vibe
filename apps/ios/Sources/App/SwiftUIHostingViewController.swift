import SwiftUI
import UIKit

/// UIKit owns the screen. SwiftUI is mounted only as this controller's child content.
class SwiftUIHostingViewController: UIViewController {
  private var hostingController: UIHostingController<AnyView>?

  final func host<Content: View>(_ content: Content) {
    let hostingController = UIHostingController(rootView: AnyView(content))
    hostingController.view.backgroundColor = .clear
    hostingController.view.translatesAutoresizingMaskIntoConstraints = false

    addChild(hostingController)
    view.addSubview(hostingController.view)
    NSLayoutConstraint.activate([
      hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
      hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    hostingController.didMove(toParent: self)
    self.hostingController = hostingController
  }
}

