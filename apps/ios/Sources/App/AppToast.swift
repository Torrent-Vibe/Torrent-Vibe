@preconcurrency import ActivityKit
import SwiftUI
import UIKit

@MainActor
enum AppToast {
  static func show(_ message: String, from presenter: UIViewController) {
    AppToastOverlay.show(message, from: presenter)
  }
}

enum AppToastPlacement: Equatable {
  case hangBelowIsland
  case islandMorph
  case topCapsule
}

enum AppToastLayout {
  static let islandGap: CGFloat = 10
  static let islandOriginY: CGFloat = 12
  static let islandSize = CGSize(width: 126, height: 37)
  static let capsuleHeight: CGFloat = 56

  static func hasDynamicIsland(
    idiom: UIUserInterfaceIdiom,
    portraitTopInset: CGFloat
  ) -> Bool {
    idiom == .phone && portraitTopInset >= 59
  }

  static func placement(
    hasDynamicIsland: Bool,
    islandOccupied: Bool
  ) -> AppToastPlacement {
    guard hasDynamicIsland else { return .topCapsule }
    return islandOccupied ? .hangBelowIsland : .islandMorph
  }

  static func islandFrame(in screenSize: CGSize) -> CGRect {
    CGRect(
      x: (screenSize.width - islandSize.width) / 2,
      y: islandOriginY,
      width: islandSize.width,
      height: islandSize.height
    )
  }

  static func expandedFrame(
    in screenSize: CGSize,
    placement: AppToastPlacement
  ) -> CGRect {
    let width = min(292, screenSize.width - 32)
    let x = (screenSize.width - width) / 2
    switch placement {
    case .islandMorph, .hangBelowIsland:
      let island = islandFrame(in: screenSize)
      return CGRect(
        x: x,
        y: island.maxY + islandGap,
        width: width,
        height: capsuleHeight
      )
    case .topCapsule:
      return CGRect(
        x: x,
        y: max(54, islandOriginY + 42),
        width: width,
        height: capsuleHeight
      )
    }
  }
}

enum AppToastPhase: Equatable {
  case compact
  case expanded
}

@MainActor
@Observable
final class AppToastState {
  var isVisible: Bool
  var phase: AppToastPhase
  let message: String
  let placement: AppToastPlacement
  let screenSize: CGSize

  init(
    message: String,
    placement: AppToastPlacement,
    screenSize: CGSize,
    reduceMotion: Bool
  ) {
    self.message = message
    self.placement = placement
    self.screenSize = screenSize
    if placement == .islandMorph, !reduceMotion {
      phase = .compact
      isVisible = true
    } else {
      phase = .expanded
      isVisible = false
    }
  }

  var currentFrame: CGRect {
    phase == .expanded
      ? AppToastLayout.expandedFrame(in: screenSize, placement: placement)
      : compactFrame
  }

  var compactFrame: CGRect {
    switch placement {
    case .islandMorph:
      AppToastLayout.islandFrame(in: screenSize)
    case .hangBelowIsland, .topCapsule:
      AppToastLayout.expandedFrame(in: screenSize, placement: placement)
    }
  }
}

@MainActor
private enum AppToastOverlay {
  private static var hideTask: Task<Void, Never>?
  private static var state: AppToastState?
  private static var window: PassThroughWindow?

  static func show(_ message: String, from presenter: UIViewController) {
    hideTask?.cancel()
    teardown()

    guard let scene = windowScene(from: presenter) else { return }
    let hostWindow = presenter.view.window ?? scene.keyWindow
    let screenSize = hostWindow?.bounds.size ?? scene.screen.bounds.size
    let isPortrait = screenSize.height >= screenSize.width
    let hasIsland =
      isPortrait
      && AppToastLayout.hasDynamicIsland(
        idiom: hostWindow?.traitCollection.userInterfaceIdiom ?? .phone,
        portraitTopInset: hostWindow?.safeAreaInsets.top ?? 0
      )
    let placement = AppToastLayout.placement(
      hasDynamicIsland: hasIsland,
      islandOccupied: isIslandOccupied
    )
    let state = AppToastState(
      message: message,
      placement: placement,
      screenSize: screenSize,
      reduceMotion: UIAccessibility.isReduceMotionEnabled
    )
    Self.state = state

    let window = PassThroughWindow(windowScene: scene)
    window.windowLevel = .statusBar + 1
    window.backgroundColor = .clear
    let host = UIHostingController(rootView: AppToastCanvas(state: state))
    host.view.backgroundColor = .clear
    window.rootViewController = host
    window.isHidden = false
    Self.window = window

    UINotificationFeedbackGenerator().notificationOccurred(.success)
    hideTask = Task { await play(state) }
  }

  private static func play(_ state: AppToastState) async {
    if state.phase == .compact {
      try? await Task.sleep(for: .milliseconds(16))
      guard !Task.isCancelled else { return }
      withAnimation(.spring(duration: 0.34, bounce: 0)) {
        state.phase = .expanded
      }
    } else {
      withAnimation(.easeOut(duration: 0.24)) {
        state.isVisible = true
      }
    }

    try? await Task.sleep(for: .seconds(1.9))
    guard !Task.isCancelled else { return }

    if state.placement == .islandMorph, !UIAccessibility.isReduceMotionEnabled {
      withAnimation(.easeIn(duration: 0.26)) {
        state.phase = .compact
      }
      try? await Task.sleep(for: .milliseconds(260))
    } else {
      withAnimation(.easeIn(duration: 0.2)) {
        state.isVisible = false
      }
      try? await Task.sleep(for: .milliseconds(200))
    }

    guard !Task.isCancelled else { return }
    teardown()
  }

  private static func teardown() {
    window?.isHidden = true
    window = nil
    state = nil
  }

  private static var isIslandOccupied: Bool {
    Activity<TorrentLiveActivityAttributes>.activities.contains {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  private static func windowScene(from presenter: UIViewController) -> UIWindowScene? {
    presenter.view.window?.windowScene
      ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
  }
}

private final class PassThroughWindow: UIWindow {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    nil
  }
}

private struct AppToastCanvas: View {
  @Bindable var state: AppToastState

  var body: some View {
    let frame = state.currentFrame
    ZStack(alignment: .topLeading) {
      Color.clear
      HStack(spacing: 8) {
        Image(systemName: "checkmark.circle.fill")
          .font(.body.weight(.semibold))
          .foregroundStyle(.green)
          .accessibilityHidden(true)
        Text(state.message)
          .font(.callout.weight(.semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }
      .opacity(state.phase == .expanded ? 1 : 0)
      .animation(
        .easeOut(duration: 0.16).delay(state.phase == .expanded ? 0.12 : 0),
        value: state.phase
      )
      .padding(.horizontal, 18)
      .frame(width: frame.width, height: frame.height)
      .background(.black, in: .capsule)
      .shadow(
        color: .black.opacity(state.phase == .expanded ? 0.28 : 0),
        radius: 16,
        y: 8
      )
      .position(x: frame.midX, y: frame.midY)
    }
    .opacity(state.isVisible ? 1 : 0)
    .ignoresSafeArea()
    .allowsHitTesting(false)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("app-toast")
  }
}
