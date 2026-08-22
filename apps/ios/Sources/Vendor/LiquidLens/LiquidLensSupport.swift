import Foundation
import UIKit

// Adapted from telegram-ios submodules/Display to satisfy LiquidLensView.swift dependencies.

@MainActor
public protocol SharedDisplayLinkDriverLink: AnyObject {
    var isPaused: Bool { get set }

    func invalidate()
}

private let isIpad: Bool = {
    var systemInfo = utsname()
    uname(&systemInfo)
    let mirror = Mirror(reflecting: systemInfo.machine)
    let identifier = mirror.children.reduce(into: "") { identifier, element in
        guard let value = element.value as? Int8, value != 0 else {
            return
        }
        identifier.append(Character(UnicodeScalar(UInt8(value))))
    }
    return identifier.hasPrefix("iPad")
}()

@MainActor
public final class SharedDisplayLinkDriver {
    public enum FramesPerSecond: Comparable {
        case fps(Int)
        case max

        public static func <(lhs: FramesPerSecond, rhs: FramesPerSecond) -> Bool {
            switch lhs {
            case let .fps(lhsFps):
                switch rhs {
                case let .fps(rhsFps):
                    return lhsFps < rhsFps
                case .max:
                    return true
                }
            case .max:
                return false
            }
        }
    }

    public typealias Link = SharedDisplayLinkDriverLink

    @MainActor public static let shared = SharedDisplayLinkDriver()

    @MainActor
    public final class LinkImpl: Link {
        private let driver: SharedDisplayLinkDriver
        public let framesPerSecond: FramesPerSecond
        let update: (CGFloat) -> Void
        var isValid: Bool = true
        public var isPaused: Bool = false {
            didSet {
                if self.isPaused != oldValue {
                    self.driver.requestUpdate()
                }
            }
        }

        init(driver: SharedDisplayLinkDriver, framesPerSecond: FramesPerSecond, update: @escaping (CGFloat) -> Void) {
            self.driver = driver
            self.framesPerSecond = framesPerSecond
            self.update = update
        }

        public func invalidate() {
        }
    }

    private final class RequestContext {
        weak var link: LinkImpl?
        let framesPerSecond: FramesPerSecond

        var lastDuration: Double = 0.0

        init(link: LinkImpl, framesPerSecond: FramesPerSecond) {
            self.link = link
            self.framesPerSecond = framesPerSecond
        }
    }

    private var displayLink: CADisplayLink?
    private var requests: [RequestContext] = []

    private var isInForeground: Bool = false
    private var isProcessingEvent: Bool = false
    private var isUpdateRequested: Bool = false

    private init() {
        NotificationCenter.default.addObserver(self, selector: #selector(self.willEnterForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(self.didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)

        if Bundle.main.bundlePath.hasSuffix(".appex") {
            self.isInForeground = true
        } else {
            switch UIApplication.shared.applicationState {
            case .active:
                self.isInForeground = true
            default:
                self.isInForeground = false
            }
        }

        self.update()
    }

    @objc private func willEnterForeground() {
        self.isInForeground = true
        self.update()
    }

    @objc private func didEnterBackground() {
        self.isInForeground = false
        self.update()
    }

    public func updateForegroundState(_ isActive: Bool) {
        if self.isInForeground != isActive {
            self.isInForeground = isActive
            self.update()
        }
    }

    private func requestUpdate() {
        if self.isProcessingEvent {
            self.isUpdateRequested = true
        } else {
            self.update()
        }
    }

    private func update() {
        var hasActiveItems = false
        var maxFramesPerSecond: FramesPerSecond = .fps(30)
        for request in self.requests {
            if let link = request.link {
                if link.framesPerSecond > maxFramesPerSecond {
                    maxFramesPerSecond = link.framesPerSecond
                }
                if link.isValid && !link.isPaused {
                    hasActiveItems = true
                    break
                }
            }
        }

        if self.isInForeground && hasActiveItems {
            let displayLink: CADisplayLink
            if let current = self.displayLink {
                displayLink = current
            } else {
                displayLink = CADisplayLink(target: self, selector: #selector(self.displayLinkEvent))
                self.displayLink = displayLink
                displayLink.add(to: .main, forMode: .common)
            }
            let maxFps = Float(UIScreen.main.maximumFramesPerSecond)
            if maxFps > 61.0 {
                var frameRateRange: CAFrameRateRange
                switch maxFramesPerSecond {
                case let .fps(fps):
                    if fps > 60 {
                        frameRateRange = CAFrameRateRange(minimum: 30.0, maximum: 120.0, preferred: 120.0)
                    } else {
                        frameRateRange = .default
                    }
                case .max:
                    frameRateRange = CAFrameRateRange(minimum: 30.0, maximum: 120.0, preferred: 120.0)
                }

                if isIpad {
                    frameRateRange = CAFrameRateRange(minimum: 30.0, maximum: 120.0, preferred: 120.0)
                }

                if displayLink.preferredFrameRateRange != frameRateRange {
                    displayLink.preferredFrameRateRange = frameRateRange
                }
            }
            displayLink.isPaused = false
        } else {
            if let displayLink = self.displayLink {
                self.displayLink = nil
                displayLink.invalidate()
            }
        }
    }

    @objc private func displayLinkEvent(displayLink: CADisplayLink) {
        self.isProcessingEvent = true

        let duration = displayLink.targetTimestamp - displayLink.timestamp

        var removeIndices: [Int]?
        loop: for i in 0 ..< self.requests.count {
            let request = self.requests[i]
            if let link = request.link, link.isValid {
                if !link.isPaused {
                    var itemDuration = duration

                    switch request.framesPerSecond {
                    case let .fps(value):
                        let secondsPerFrame = 1.0 / CGFloat(value)
                        itemDuration = secondsPerFrame
                        request.lastDuration += duration
                        if request.lastDuration >= secondsPerFrame * 0.95 {
                        } else {
                            continue loop
                        }
                    case .max:
                        break
                    }

                    request.lastDuration = 0.0
                    link.update(itemDuration)
                }
            } else {
                if removeIndices == nil {
                    removeIndices = [i]
                } else {
                    removeIndices?.append(i)
                }
            }
        }
        if let removeIndices = removeIndices {
            for index in removeIndices.reversed() {
                self.requests.remove(at: index)
            }

            if self.requests.isEmpty {
                self.isUpdateRequested = true
            }
        }

        self.isProcessingEvent = false
        if self.isUpdateRequested {
            self.isUpdateRequested = false
            self.update()
        }
    }

    public func add(framesPerSecond: FramesPerSecond = .fps(60), _ update: @escaping (CGFloat) -> Void) -> Link {
        let link = LinkImpl(driver: self, framesPerSecond: framesPerSecond, update: update)
        self.requests.append(RequestContext(link: link, framesPerSecond: framesPerSecond))

        self.update()

        return link
    }
}

public extension CALayer {
    static func luminanceToAlpha() -> NSObject? {
        if let classValue = NSClassFromString("CAFilter") as AnyObject as? NSObjectProtocol {
            let makeSelector = NSSelectorFromString("filterWithName:")
            let filter = classValue.perform(makeSelector, with: "luminanceToAlpha").takeUnretainedValue() as? NSObject
            return filter
        }
        return nil
    }
}

public func generateImage(_ size: CGSize, contextGenerator: (CGSize, CGContext) -> Void, opaque: Bool = false, scale: CGFloat? = nil) -> UIImage? {
    if size.width.isZero || size.height.isZero {
        return nil
    }
    let selectedScale = scale ?? UIScreen.main.scale
    let pixelWidth = Int(size.width * selectedScale)
    let pixelHeight = Int(size.height * selectedScale)
    guard pixelWidth >= 1, pixelHeight >= 1 else {
        return nil
    }
    let format = UIGraphicsImageRendererFormat()
    format.scale = selectedScale
    format.opaque = opaque
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
        guard let context = UIGraphicsGetCurrentContext() else {
            return
        }
        contextGenerator(size, context)
    }
}

public func generateFilledCircleImage(diameter: CGFloat, color: UIColor?, strokeColor: UIColor? = nil, strokeWidth: CGFloat? = nil, backgroundColor: UIColor? = nil) -> UIImage? {
    return generateImage(CGSize(width: diameter, height: diameter), contextGenerator: { size, context in
        context.clear(CGRect(origin: CGPoint(), size: size))
        if let backgroundColor = backgroundColor {
            context.setFillColor(backgroundColor.cgColor)
            context.fill(CGRect(origin: CGPoint(), size: size))
        }

        if let strokeColor = strokeColor, let strokeWidth = strokeWidth {
            context.setFillColor(strokeColor.cgColor)
            context.fillEllipse(in: CGRect(origin: CGPoint(), size: size))

            if let color = color {
                context.setFillColor(color.cgColor)
            } else {
                context.setFillColor(UIColor.clear.cgColor)
                context.setBlendMode(.copy)
            }
            context.fillEllipse(in: CGRect(origin: CGPoint(x: strokeWidth, y: strokeWidth), size: CGSize(width: size.width - strokeWidth * 2.0, height: size.height - strokeWidth * 2.0)))
        } else {
            if let color = color {
                context.setFillColor(color.cgColor)
            } else {
                context.setFillColor(UIColor.clear.cgColor)
                context.setBlendMode(.copy)
            }
            context.fillEllipse(in: CGRect(origin: CGPoint(), size: size))
        }
    })
}

public func generateStretchableFilledCircleImage(diameter: CGFloat, color: UIColor?, strokeColor: UIColor? = nil, strokeWidth: CGFloat? = nil, backgroundColor: UIColor? = nil) -> UIImage? {
    let intRadius = Int(diameter / 2.0)
    let intDiameter = Int(diameter)
    let cap: Int
    if intDiameter == 3 {
        cap = 1
    } else if intDiameter == 2 {
        cap = 3
    } else if intRadius == 1 {
        cap = 2
    } else {
        cap = intRadius
    }

    return generateFilledCircleImage(diameter: diameter, color: color, strokeColor: strokeColor, strokeWidth: strokeWidth, backgroundColor: backgroundColor)?.stretchableImage(withLeftCapWidth: cap, topCapHeight: cap)
}

// Minimal stand-ins for telegram-ios submodules/GlassBackgroundComponent. LiquidLensView instantiates
// them only for kinds we never use (.noContainer) and on the pre-iOS 26 legacy branch; the API surface
// mirrors the original so LiquidLensView.swift stays unmodified.

public final class GlassBackgroundContainerView: UIView {
    public let contentView: UIView

    public override init(frame: CGRect) {
        self.contentView = UIView()

        super.init(frame: frame)

        self.addSubview(self.contentView)
    }

    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public func update(size: CGSize, isDark: Bool, transition: ComponentTransition) {
        transition.setFrame(view: self.contentView, frame: CGRect(origin: CGPoint(), size: size))
    }
}

public final class GlassBackgroundView: UIView {
    public final class ContentImageView: UIImageView {
    }

    public struct TintColor {
        public enum Kind {
            case panel
        }

        public init(kind: Kind) {
        }
    }

    public let contentView: UIView
    private let effectView: UIVisualEffectView

    public override init(frame: CGRect) {
        self.contentView = UIView()
        self.effectView = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))

        super.init(frame: frame)

        self.effectView.clipsToBounds = true
        self.contentView.clipsToBounds = true

        self.addSubview(self.effectView)
        self.addSubview(self.contentView)
    }

    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public func update(size: CGSize, cornerRadius: CGFloat?, isDark: Bool, tintColor: TintColor, isInteractive: Bool, transition: ComponentTransition) {
        self.clipsToBounds = true
        self.layer.cornerRadius = cornerRadius ?? size.height * 0.5
        transition.setFrame(view: self.effectView, frame: CGRect(origin: CGPoint(), size: size))
        transition.setFrame(view: self.contentView, frame: CGRect(origin: CGPoint(), size: size))
    }
}
