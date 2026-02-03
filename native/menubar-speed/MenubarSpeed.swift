import AppKit
import Foundation

// Global state
private var statusItem: NSStatusItem?
private var isInitialized = false
private var showCallback: (() -> Void)?
private var quitCallback: (() -> Void)?

// Menu speed view with chart
private var menuSpeedView: MenuSpeedView?

// Speed history for chart
private var downloadHistory: [Int64] = Array(repeating: 0, count: 60)
private var uploadHistory: [Int64] = Array(repeating: 0, count: 60)

// Colors for arrows
private let uploadColor = NSColor(red: 0.34, green: 0.76, blue: 0.49, alpha: 1.0)
private let downloadColor = NSColor(red: 0.32, green: 0.64, blue: 0.95, alpha: 1.0)

// MARK: - Status bar speed display helpers

private func updateStatusBarSpeed(download: Int64, upload: Int64) {
    guard let button = statusItem?.button else { return }

    let uploadStr = formatSpeed(upload)
    let downloadStr = formatSpeed(download)

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .left
    paragraphStyle.lineSpacing = -2
    paragraphStyle.minimumLineHeight = 10
    paragraphStyle.maximumLineHeight = 10

    button.alignment = .left
    button.title = ""

    let result = NSMutableAttributedString()

    // Download line
    let downArrow = NSAttributedString(
        string: "↓ ",
        attributes: [
            .foregroundColor: downloadColor,
            .font: NSFont.systemFont(ofSize: 9, weight: .medium),
            .paragraphStyle: paragraphStyle,
            .baselineOffset: -2
        ]
    )
    result.append(downArrow)

    let downSpeed = NSAttributedString(
        string: downloadStr,
        attributes: [
            .foregroundColor: NSColor.labelColor,
            .font: NSFont.monospacedDigitSystemFont(ofSize: 9, weight: .regular),
            .paragraphStyle: paragraphStyle,
            .baselineOffset: -2
        ]
    )
    result.append(downSpeed)

    result.append(NSAttributedString(string: "\n"))

    // Upload line
    let upArrow = NSAttributedString(
        string: "↑ ",
        attributes: [
            .foregroundColor: uploadColor,
            .font: NSFont.systemFont(ofSize: 9, weight: .medium),
            .paragraphStyle: paragraphStyle,
            .baselineOffset: -2
        ]
    )
    result.append(upArrow)

    let upSpeed = NSAttributedString(
        string: uploadStr,
        attributes: [
            .foregroundColor: NSColor.labelColor,
            .font: NSFont.monospacedDigitSystemFont(ofSize: 9, weight: .regular),
            .paragraphStyle: paragraphStyle,
            .baselineOffset: -2
        ]
    )
    result.append(upSpeed)

    button.attributedTitle = result

    // Auto adjust width
    let size = result.size()
    let newWidth = max(size.width + 6, 52)
    if abs((statusItem?.length ?? 0) - newWidth) > 2 {
        statusItem?.length = newWidth
    }
}

// MARK: - Speed Chart View

private class SpeedChartView: NSView {
    var downloadData: [Int64] = []
    var uploadData: [Int64] = []

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        guard let context = NSGraphicsContext.current?.cgContext else { return }

        let chartRect = bounds.insetBy(dx: 0, dy: 2)

        // Draw background grid
        context.setStrokeColor(NSColor.separatorColor.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)

        // Horizontal grid lines
        for i in 1..<4 {
            let y = chartRect.minY + chartRect.height * CGFloat(i) / 4
            context.move(to: CGPoint(x: chartRect.minX, y: y))
            context.addLine(to: CGPoint(x: chartRect.maxX, y: y))
        }
        context.strokePath()

        // Find max value for scaling
        let allData = downloadData + uploadData
        let maxValue = max(allData.max() ?? 1, 1)

        // Draw upload line (behind)
        drawSpeedLine(context: context, data: uploadData, maxValue: maxValue, rect: chartRect, color: uploadColor)

        // Draw download line (front)
        drawSpeedLine(context: context, data: downloadData, maxValue: maxValue, rect: chartRect, color: downloadColor)
    }

    private func drawSpeedLine(context: CGContext, data: [Int64], maxValue: Int64, rect: NSRect, color: NSColor) {
        guard data.count > 1 else { return }

        let path = CGMutablePath()
        let fillPath = CGMutablePath()

        let stepX = rect.width / CGFloat(data.count - 1)

        var firstPoint: CGPoint?

        for (index, value) in data.enumerated() {
            let x = rect.minX + CGFloat(index) * stepX
            let normalizedValue = CGFloat(value) / CGFloat(maxValue)
            let y = rect.minY + normalizedValue * rect.height

            let point = CGPoint(x: x, y: y)

            if index == 0 {
                path.move(to: point)
                fillPath.move(to: CGPoint(x: x, y: rect.minY))
                fillPath.addLine(to: point)
                firstPoint = point
            } else {
                path.addLine(to: point)
                fillPath.addLine(to: point)
            }
        }

        // Complete fill path
        if let _ = firstPoint {
            fillPath.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            fillPath.closeSubpath()

            // Draw gradient fill
            context.saveGState()
            context.addPath(fillPath)
            context.clip()

            let colors = [color.withAlphaComponent(0.3).cgColor, color.withAlphaComponent(0.05).cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [1.0, 0.0]) {
                context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: rect.maxY), end: CGPoint(x: 0, y: rect.minY), options: [])
            }
            context.restoreGState()
        }

        // Draw line
        context.setStrokeColor(color.cgColor)
        context.setLineWidth(1.5)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.addPath(path)
        context.strokePath()
    }

    func updateData(download: [Int64], upload: [Int64]) {
        downloadData = download
        uploadData = upload
        needsDisplay = true
    }
}

// MARK: - Menu Speed View (compact display with chart)

private class MenuSpeedView: NSView {
    private let downloadLabel = NSTextField(labelWithString: "")
    private let uploadLabel = NSTextField(labelWithString: "")
    private let downloadValueLabel = NSTextField(labelWithString: "")
    private let uploadValueLabel = NSTextField(labelWithString: "")
    private let chartView = SpeedChartView()

    private let viewWidth: CGFloat = 200
    private let viewHeight: CGFloat = 100

    override init(frame frameRect: NSRect) {
        super.init(frame: NSRect(x: 0, y: 0, width: viewWidth, height: viewHeight))
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        wantsLayer = true

        // Download row - compact font
        downloadLabel.stringValue = "↓"
        downloadLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        downloadLabel.textColor = downloadColor
        downloadLabel.backgroundColor = .clear
        downloadLabel.isBezeled = false
        downloadLabel.isEditable = false
        downloadLabel.isSelectable = false
        downloadLabel.alignment = .left
        downloadLabel.translatesAutoresizingMaskIntoConstraints = false

        downloadValueLabel.stringValue = "0 B/s"
        downloadValueLabel.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular)
        downloadValueLabel.textColor = .labelColor
        downloadValueLabel.backgroundColor = .clear
        downloadValueLabel.isBezeled = false
        downloadValueLabel.isEditable = false
        downloadValueLabel.isSelectable = false
        downloadValueLabel.alignment = .left
        downloadValueLabel.translatesAutoresizingMaskIntoConstraints = false

        // Upload row - compact font
        uploadLabel.stringValue = "↑"
        uploadLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        uploadLabel.textColor = uploadColor
        uploadLabel.backgroundColor = .clear
        uploadLabel.isBezeled = false
        uploadLabel.isEditable = false
        uploadLabel.isSelectable = false
        uploadLabel.alignment = .left
        uploadLabel.translatesAutoresizingMaskIntoConstraints = false

        uploadValueLabel.stringValue = "0 B/s"
        uploadValueLabel.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular)
        uploadValueLabel.textColor = .labelColor
        uploadValueLabel.backgroundColor = .clear
        uploadValueLabel.isBezeled = false
        uploadValueLabel.isEditable = false
        uploadValueLabel.isSelectable = false
        uploadValueLabel.alignment = .left
        uploadValueLabel.translatesAutoresizingMaskIntoConstraints = false

        // Chart view
        chartView.translatesAutoresizingMaskIntoConstraints = false
        chartView.wantsLayer = true

        addSubview(downloadLabel)
        addSubview(downloadValueLabel)
        addSubview(uploadLabel)
        addSubview(uploadValueLabel)
        addSubview(chartView)

        let hPadding: CGFloat = 12
        let topPadding: CGFloat = 10
        let bottomPadding: CGFloat = 8
        let rowHeight: CGFloat = 14

        NSLayoutConstraint.activate([
            // Download row - left aligned
            downloadLabel.topAnchor.constraint(equalTo: topAnchor, constant: topPadding),
            downloadLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: hPadding),
            downloadLabel.widthAnchor.constraint(equalToConstant: 14),
            downloadLabel.heightAnchor.constraint(equalToConstant: rowHeight),

            downloadValueLabel.centerYAnchor.constraint(equalTo: downloadLabel.centerYAnchor),
            downloadValueLabel.leadingAnchor.constraint(equalTo: downloadLabel.trailingAnchor, constant: 2),

            // Upload row - no gap between rows
            uploadLabel.topAnchor.constraint(equalTo: downloadLabel.bottomAnchor, constant: 0),
            uploadLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: hPadding),
            uploadLabel.widthAnchor.constraint(equalToConstant: 14),
            uploadLabel.heightAnchor.constraint(equalToConstant: rowHeight),

            uploadValueLabel.centerYAnchor.constraint(equalTo: uploadLabel.centerYAnchor),
            uploadValueLabel.leadingAnchor.constraint(equalTo: uploadLabel.trailingAnchor, constant: 2),

            // Chart
            chartView.topAnchor.constraint(equalTo: uploadLabel.bottomAnchor, constant: 6),
            chartView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: hPadding),
            chartView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -hPadding),
            chartView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -bottomPadding),
        ])
    }

    func updateSpeed(download: Int64, upload: Int64, downloadHistory: [Int64], uploadHistory: [Int64]) {
        downloadValueLabel.stringValue = formatSpeed(download)
        uploadValueLabel.stringValue = formatSpeed(upload)
        chartView.updateData(download: downloadHistory, upload: uploadHistory)
    }
}

// MARK: - C-compatible exports

@_cdecl("menubar_speed_init")
public func menubarSpeedInit() -> Bool {
    guard !isInitialized else { return true }

    if Thread.isMainThread {
        return initializeStatusItem()
    } else {
        var result = false
        DispatchQueue.main.sync {
            result = initializeStatusItem()
        }
        return result
    }
}

@_cdecl("menubar_speed_update")
public func menubarSpeedUpdate(downloadSpeed: Int64, uploadSpeed: Int64) {
    let updateBlock: () -> Void = {
        // Update history
        downloadHistory.removeFirst()
        downloadHistory.append(downloadSpeed)
        uploadHistory.removeFirst()
        uploadHistory.append(uploadSpeed)

        updateStatusBarSpeed(download: downloadSpeed, upload: uploadSpeed)
        menuSpeedView?.updateSpeed(download: downloadSpeed, upload: uploadSpeed, downloadHistory: downloadHistory, uploadHistory: uploadHistory)
    }

    if Thread.isMainThread {
        updateBlock()
    } else {
        DispatchQueue.main.async {
            updateBlock()
        }
    }
}

@_cdecl("menubar_speed_destroy")
public func menubarSpeedDestroy() {
    let destroyBlock = {
        if let item = statusItem {
            NSStatusBar.system.removeStatusItem(item)
            statusItem = nil
        }
        menuSpeedView = nil
        isInitialized = false
    }

    if Thread.isMainThread {
        destroyBlock()
    } else {
        DispatchQueue.main.sync(execute: destroyBlock)
    }
}

public typealias MenuCallback = @convention(c) () -> Void

@_cdecl("menubar_speed_set_show_callback")
public func menubarSpeedSetShowCallback(_ callback: @escaping MenuCallback) {
    showCallback = callback
}

@_cdecl("menubar_speed_set_quit_callback")
public func menubarSpeedSetQuitCallback(_ callback: @escaping MenuCallback) {
    quitCallback = callback
}

// MARK: - Private helpers

private func initializeStatusItem() -> Bool {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

    guard let item = statusItem else {
        return false
    }

    item.length = 80

    // Initial speed display
    updateStatusBarSpeed(download: 0, upload: 0)

    // Setup menu with custom view
    let menu = NSMenu()

    // Custom speed view with chart (at top)
    let speedMenuItem = NSMenuItem()
    let speedContentView = MenuSpeedView()
    menuSpeedView = speedContentView
    speedMenuItem.view = speedContentView
    menu.addItem(speedMenuItem)

    menu.addItem(NSMenuItem.separator())

    let showItem = NSMenuItem(title: "显示主窗口", action: #selector(MenubarActions.showApp), keyEquivalent: "")
    showItem.target = MenubarActions.shared
    menu.addItem(showItem)

    menu.addItem(NSMenuItem.separator())

    let quitItem = NSMenuItem(title: "退出", action: #selector(MenubarActions.quitApp), keyEquivalent: "q")
    quitItem.target = MenubarActions.shared
    menu.addItem(quitItem)

    item.menu = menu

    isInitialized = true
    return true
}

private func formatSpeed(_ bytesPerSecond: Int64) -> String {
    let units = ["B/s", "KB/s", "MB/s", "GB/s"]
    var value = Double(bytesPerSecond)
    var unitIndex = 0

    while value >= 1024 && unitIndex < units.count - 1 {
        value /= 1024
        unitIndex += 1
    }

    if unitIndex == 0 {
        return String(format: "%.0f %@", value, units[unitIndex])
    } else if value < 10 {
        return String(format: "%.1f %@", value, units[unitIndex])
    } else {
        return String(format: "%.0f %@", value, units[unitIndex])
    }
}

// MARK: - Menu action handler

private class MenubarActions: NSObject {
    static let shared = MenubarActions()

    @objc func showApp() {
        showCallback?()
    }

    @objc func quitApp() {
        quitCallback?()
    }
}
