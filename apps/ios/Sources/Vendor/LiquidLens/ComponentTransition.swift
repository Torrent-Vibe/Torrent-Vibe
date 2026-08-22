import Foundation
import UIKit

// Subset of telegram-ios submodules/ComponentFlow Transition.swift covering the API used by
// LiquidLensView and the tab bar; animation semantics (durations, spring/easeInOut, immediate) match.

#if targetEnvironment(simulator)
@_silgen_name("UIAnimationDragCoefficient") func UIAnimationDragCoefficient() -> Float
#endif

public extension UIView {
    static var animationDurationFactor: Double {
        #if targetEnvironment(simulator)
        return Double(UIAnimationDragCoefficient())
        #else
        return 1.0
        #endif
    }
}

@MainActor
public struct ComponentTransition {
    public enum Animation {
        case none
        case spring(duration: Double)
        case easeInOut(duration: Double)

        public var isImmediate: Bool {
            if case .none = self {
                return true
            } else {
                return false
            }
        }

        var duration: TimeInterval {
            let factor = UIView.animationDurationFactor
            switch self {
            case .none:
                return 0.0
            case let .spring(duration):
                return duration * factor
            case let .easeInOut(duration):
                return duration * factor
            }
        }
    }

    public var animation: Animation

    private var userDataStorage: [ObjectIdentifier: Any] = [:]

    public init() {
        self.animation = .none
    }

    public init(animation: Animation) {
        self.animation = animation
    }

    public static let immediate = ComponentTransition()

    public func userData<T>(_ type: T.Type) -> T? {
        return self.userDataStorage[ObjectIdentifier(type)] as? T
    }

    public func withUserData(_ value: Any) -> ComponentTransition {
        var result = self
        result.userDataStorage[ObjectIdentifier(type(of: value))] = value
        return result
    }
    public static func spring(duration: Double) -> ComponentTransition {
        return ComponentTransition(animation: .spring(duration: duration))
    }

    public static func easeInOut(duration: Double) -> ComponentTransition {
        return ComponentTransition(animation: .easeInOut(duration: duration))
    }

    public func withAnimation(_ animation: Animation) -> ComponentTransition {
        var result = self
        result.animation = animation
        return result
    }

    private func animate(_ animations: @escaping () -> Void, completion: ((Bool) -> Void)? = nil) {
        if self.animation.isImmediate {
            animations()
            completion?(true)
            return
        }
        let duration = self.animation.duration
        switch self.animation {
        case .spring:
            UIView.animate(withDuration: duration, delay: 0.0, usingSpringWithDamping: 1.0, initialSpringVelocity: 0.0, options: [.beginFromCurrentState, .allowUserInteraction], animations: animations, completion: { completed in
                completion?(completed)
            })
        case .easeInOut:
            UIView.animate(withDuration: duration, delay: 0.0, options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseInOut], animations: animations, completion: { completed in
                completion?(completed)
            })
        case .none:
            animations()
            completion?(true)
        }
    }

    public func animateView(_ animations: @escaping () -> Void) {
        if self.animation.isImmediate {
            animations()
        } else {
            UIView.animate(withDuration: self.animation.duration, delay: 0.0, options: [.beginFromCurrentState, .allowUserInteraction], animations: animations, completion: nil)
        }
    }

    public func setFrame(view: UIView, frame: CGRect, completion: ((Bool) -> Void)? = nil) {
        self.animate({
            view.frame = frame
        }, completion: completion)
    }

    public func setBounds(view: UIView, bounds: CGRect, completion: ((Bool) -> Void)? = nil) {
        self.animate({
            view.bounds = bounds
        }, completion: completion)
    }

    public func setPosition(view: UIView, position: CGPoint, completion: ((Bool) -> Void)? = nil) {
        self.animate({
            view.center = position
        }, completion: completion)
    }

    public func setAlpha(view: UIView, alpha: CGFloat, completion: ((Bool) -> Void)? = nil) {
        self.animate({
            view.alpha = alpha
        }, completion: completion)
    }

    public func setCornerRadius(layer: CALayer, cornerRadius: CGFloat) {
        self.animate({
            layer.cornerRadius = cornerRadius
        })
    }

    public func animatePosition(layer: CALayer, from: CGPoint, to: CGPoint, additive: Bool) {
        guard !self.animation.isImmediate else {
            return
        }
        let animation = CABasicAnimation(keyPath: "position")
        animation.fromValue = NSValue(cgPoint: CGPoint(x: layer.position.x + from.x, y: layer.position.y + from.y))
        animation.toValue = NSValue(cgPoint: CGPoint(x: layer.position.x + to.x, y: layer.position.y + to.y))
        animation.isAdditive = additive
        animation.duration = self.animation.duration
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        animation.fillMode = .both
        layer.add(animation, forKey: "position")
    }
}
